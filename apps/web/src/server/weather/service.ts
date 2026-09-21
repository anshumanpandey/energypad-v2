import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { FoundationService, type Actor, type Mailer } from '../foundation';
import { DomainError, uuid } from '../../domain/policy';
import {
  weatherConfigurationInput,
  weatherDates,
  enrichmentInput,
  aggregateWeather,
  weatherMethod,
} from '../../domain/weather';
import type { WeatherProvider } from './provider';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export class WeatherService extends FoundationService {
  constructor(
    db: PrismaClient,
    mail: Mailer,
    appUrl: string,
    private provider: WeatherProvider,
  ) {
    super(db, mail, appUrl);
  }
  protected async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string) {
    uuid.parse(siteId);
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
    if (!(await tx.site.findFirst({ where: { id: siteId, organisationId: org, archivedAt: null } })))
      throw new DomainError('NOT_FOUND', 'This active site is not available.', 404);
  }
  async list(actor: Actor, org: string, siteId: string, year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new DomainError('YEAR', 'Choose a valid year.');
    await this.getSite(actor, org, siteId);
    return {
      jobs: await this.db.weatherJob.findMany({
        where: { organisationId: org, siteId, year },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          configurationId: true,
          status: true,
          attempts: true,
          totalAttempts: true,
          availableAt: true,
          lastError: true,
          updatedAt: true,
          finishedAt: true,
        },
      }),
      configurations: await this.db.weatherConfiguration.findMany({
        where: { organisationId: org, siteId },
        orderBy: { version: 'desc' },
      }),
      results: await this.db.weatherYear.findMany({
        where: { organisationId: org, siteId, year },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          configurationId: true,
          year: true,
          methodology: true,
          monthly: true,
          provenance: true,
          inputHash: true,
          createdAt: true,
        },
      }),
    };
  }
  async configure(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = weatherConfigurationInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const previous = await tx.weatherConfiguration.findFirst({
        where: { organisationId: org, siteId },
        orderBy: { version: 'desc' },
      });
      const config = await tx.weatherConfiguration.create({
        data: { ...data, organisationId: org, siteId, version: (previous?.version ?? 0) + 1, authorId: actor.userId },
      });
      await this.audit(tx, actor, org, 'weather.configured', config.id, { siteId, version: config.version });
      return config;
    });
  }
  protected async checkLease(tx: Prisma.TransactionClient, lease?: { id: string; token: string }) {
    if (
      lease &&
      !(await tx.weatherJob.findFirst({
        where: { id: lease.id, leaseToken: lease.token, status: 'RUNNING', leaseUntil: { gt: new Date() } },
      }))
    )
      throw new DomainError('JOB_LEASE_LOST', 'This weather attempt is no longer active.', 409);
  }
  private async completeJob(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    resultId: string,
    lease?: { id: string; token: string },
  ) {
    if (!lease) return;
    await this.checkLease(tx, lease);
    await tx.weatherJob.update({
      where: { id: lease.id },
      data: {
        status: 'SUCCEEDED',
        resultId,
        leaseToken: null,
        leaseUntil: null,
        lastError: null,
        lastErrorCode: null,
        finishedAt: new Date(),
      },
    });
    await this.audit(tx, actor, org, 'weather.job_succeeded', lease.id, { resultId });
  }
  async enrich(actor: Actor, org: string, siteId: string, input: unknown, lease?: { id: string; token: string }) {
    const { configurationId, year } = enrichmentInput.parse(input);
    const range = weatherDates(year);
    const identity = { configurationId, year, methodology: weatherMethod };
    const prepared = await this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      await this.checkLease(tx, lease);
      const config = await tx.weatherConfiguration.findFirst({
        where: { id: configurationId, organisationId: org, siteId },
      });
      if (!config) throw new DomainError('NOT_FOUND', 'This weather configuration is not available.', 404);
      const existing = await tx.weatherYear.findUnique({ where: { configurationId_year_methodology: identity } });
      if (existing) {
        await this.completeJob(tx, actor, org, existing.id, lease);
        return { config, existing };
      }
      const window = Math.floor(Date.now() / 3600000),
        key = `weather:${org}:${window}`;
      const bucket = await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
        update: { count: { increment: 1 } },
      });
      if (bucket.count > 20)
        throw new DomainError('RATE_LIMIT', 'Please wait before requesting more weather data.', 429);
      return { config, existing: null };
    });
    if (prepared.existing) return prepared.existing;
    const config = prepared.config;
    // Network I/O must not hold the organisation lock. Reauthorize before persistence.
    const settings = {
      latitude: config.latitude.toString(),
      longitude: config.longitude.toString(),
      timezone: config.timezone,
    };
    const weather = await this.provider.fetchYear({ ...settings, ...range });
    const monthly = aggregateWeather(weather.days, {
      heatingBase: config.heatingBase.toString(),
      coolingBase: config.coolingBase.toString(),
    });
    const inputHash = createHash('sha256')
      .update(
        JSON.stringify({
          configurationId,
          year,
          methodology: weatherMethod,
          days: weather.days,
          provenance: weather.provenance,
        }),
      )
      .digest('hex');
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      await this.checkLease(tx, lease);
      const existing = await tx.weatherYear.findUnique({ where: { configurationId_year_methodology: identity } });
      if (existing) {
        await this.completeJob(tx, actor, org, existing.id, lease);
        return existing;
      }
      const result = await tx.weatherYear.create({
        data: {
          ...identity,
          organisationId: org,
          siteId,
          provenance: json(weather.provenance),
          daily: json(weather.days),
          monthly: json(monthly),
          inputHash,
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'weather.enriched', result.id, {
        siteId,
        configurationId,
        year,
        days: weather.days.length,
        methodology: weatherMethod,
      });
      await this.completeJob(tx, actor, org, result.id, lease);
      return result;
    });
  }
}
