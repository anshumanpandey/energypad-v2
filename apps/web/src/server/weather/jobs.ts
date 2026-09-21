import { randomUUID } from 'node:crypto';
import type { Prisma, WeatherJob } from '@prisma/client';
import { WeatherService } from './service';
import type { Actor } from '../foundation';
import { DomainError, uuid } from '../../domain/policy';
import { enrichmentInput, weatherDates, weatherMethod } from '../../domain/weather';
import { weatherFailure, weatherJobAttempts, weatherLeaseMs, weatherRetryDelay } from '../../domain/weather-jobs';
export class WeatherJobs extends WeatherService {
  private async requestLimit(tx: Prisma.TransactionClient, org: string) {
    const window = Math.floor(Date.now() / 3600000),
      key = `weather-job-request:${org}:${window}`;
    const bucket = await tx.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: new Date((window + 1) * 3600000) },
      update: { count: { increment: 1 } },
    });
    if (bucket.count > 20) throw new DomainError('RATE_LIMIT', 'Please wait before requesting more weather jobs.', 429);
  }
  async enqueue(actor: Actor, org: string, siteId: string, input: unknown) {
    const { configurationId, year } = enrichmentInput.parse(input);
    weatherDates(year);
    const identity = { configurationId, year, methodology: weatherMethod };
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      if (!(await tx.weatherConfiguration.findFirst({ where: { id: configurationId, organisationId: org, siteId } })))
        throw new DomainError('NOT_FOUND', 'This weather configuration is not available.', 404);
      const existing = await tx.weatherJob.findUnique({ where: { configurationId_year_methodology: identity } });
      if (existing) return existing;
      await this.requestLimit(tx, org);
      const result = await tx.weatherYear.findUnique({ where: { configurationId_year_methodology: identity } });
      const job = await tx.weatherJob.create({
        data: {
          ...identity,
          organisationId: org,
          siteId,
          requestedBy: actor.userId,
          correlationId: actor.correlationId,
          status: result ? 'SUCCEEDED' : 'QUEUED',
          resultId: result?.id,
          finishedAt: result ? new Date() : null,
        },
      });
      await this.audit(tx, actor, org, 'weather.job_queued', job.id, {
        siteId,
        configurationId,
        year,
        cached: !!result,
      });
      return job;
    });
  }
  async retry(actor: Actor, org: string, siteId: string, id: string) {
    uuid.parse(id);
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId);
      const job = await tx.weatherJob.findFirst({ where: { id, organisationId: org, siteId } });
      if (!job) throw new DomainError('NOT_FOUND', 'This weather job is not available.', 404);
      if (job.status !== 'FAILED') return job;
      weatherDates(job.year);
      await this.requestLimit(tx, org);
      const updated = await tx.weatherJob.update({
        where: { id },
        data: {
          status: 'QUEUED',
          attempts: 0,
          requestedBy: actor.userId,
          correlationId: actor.correlationId,
          availableAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastError: null,
          lastErrorCode: null,
          finishedAt: null,
        },
      });
      await this.audit(tx, actor, org, 'weather.job_retried', id, { previousAttempts: job.totalAttempts });
      return updated;
    });
  }
  // Called only by the trusted worker process, never exposed as an HTTP route.
  async processOne(): Promise<boolean> {
    const now = new Date();
    const candidate = await this.db.weatherJob.findFirst({
      where: {
        OR: [
          { status: { in: ['QUEUED', 'RETRY_WAIT'] }, availableAt: { lte: now } },
          { status: 'RUNNING', leaseUntil: { lte: now } },
        ],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    });
    if (!candidate) return false;
    const claim = await this.db.$transaction(async (tx) => {
      await this.lock(tx, candidate.organisationId);
      const job = await tx.weatherJob.findUniqueOrThrow({ where: { id: candidate.id } });
      const due =
        (['QUEUED', 'RETRY_WAIT'].includes(job.status) && +job.availableAt <= Date.now()) ||
        (job.status === 'RUNNING' && job.leaseUntil !== null && +job.leaseUntil <= Date.now());
      if (!due) return null;
      const actor = { userId: job.requestedBy, correlationId: job.correlationId };
      if (job.attempts >= weatherJobAttempts) {
        await tx.weatherJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            leaseToken: null,
            leaseUntil: null,
            lastErrorCode: 'WORKER_INTERRUPTED',
            lastError: 'Processing was interrupted and the retry limit was reached. You can retry this job.',
            finishedAt: new Date(),
          },
        });
        await this.audit(tx, actor, job.organisationId, 'weather.job_failed', job.id, {
          code: 'WORKER_INTERRUPTED',
          attempts: job.attempts,
        });
        return null;
      }
      if (job.status === 'RUNNING')
        await this.audit(tx, actor, job.organisationId, 'weather.job_recovered', job.id, { attempt: job.attempts });
      const claimed = await tx.weatherJob.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          attempts: { increment: 1 },
          totalAttempts: { increment: 1 },
          leaseToken: randomUUID(),
          leaseUntil: new Date(Date.now() + weatherLeaseMs),
        },
      });
      await this.audit(tx, actor, job.organisationId, 'weather.job_started', job.id, {
        attempt: claimed.attempts,
        totalAttempts: claimed.totalAttempts,
      });
      return claimed;
    });
    if (!claim) return true;
    const actor = { userId: claim.requestedBy, correlationId: claim.correlationId };
    try {
      if (claim.methodology !== weatherMethod)
        throw new DomainError('WEATHER_METHOD', 'This job requires an unavailable methodology.', 409);
      await this.enrich(
        actor,
        claim.organisationId,
        claim.siteId,
        { configurationId: claim.configurationId, year: claim.year },
        { id: claim.id, token: claim.leaseToken! },
      );
    } catch (error) {
      await this.failAttempt(claim, error);
    }
    return true;
  }
  private async failAttempt(claim: WeatherJob, error: unknown) {
    const failure = weatherFailure(error);
    await this.db.$transaction(async (tx) => {
      await this.lock(tx, claim.organisationId);
      const job = await tx.weatherJob.findFirst({
        where: { id: claim.id, status: 'RUNNING', leaseToken: claim.leaseToken },
      });
      if (!job) return; // A reclaimed attempt owns this job now; never overwrite it.
      const retry = failure.retryable && job.attempts < weatherJobAttempts;
      await tx.weatherJob.update({
        where: { id: job.id },
        data: {
          status: retry ? 'RETRY_WAIT' : 'FAILED',
          availableAt: new Date(Date.now() + weatherRetryDelay(job.attempts, failure.code)),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: failure.code,
          lastError: failure.message,
          finishedAt: retry ? null : new Date(),
        },
      });
      await this.audit(
        tx,
        { userId: job.requestedBy, correlationId: job.correlationId },
        job.organisationId,
        retry ? 'weather.job_retry_scheduled' : 'weather.job_failed',
        job.id,
        { code: failure.code, attempt: job.attempts, totalAttempts: job.totalAttempts },
      );
    });
  }
}
