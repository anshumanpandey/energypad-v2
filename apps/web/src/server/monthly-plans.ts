import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { correctionReason } from '../domain/energy';
import { monthlyPlanInput, expandPlanMonths, type MonthlyPlanPayload } from '../domain/monthly-plans';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export class MonthlyPlanService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, write: boolean) {
    uuid.parse(siteId);
    const member = await this.membership(actor, org, write ? 'analysis:write' : undefined, tx);
    if (
      !(await tx.site.findFirst({
        where: {
          id: siteId,
          organisationId: org,
          ...(write ? { archivedAt: null } : {}),
          ...(member.role === 'SITE_MANAGER'
            ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
            : {}),
        },
      }))
    )
      throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
  }
  async list(actor: Actor, org: string, siteId: string, year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2199)
      throw new DomainError('YEAR', 'Choose a year from 1900 to 2199.');
    return this.db.$transaction(async (tx) => {
      await this.access(tx, actor, org, siteId, false);
      return tx.monthlyPlanVersion.findMany({
        where: { organisationId: org, siteId, month: { startsWith: `${year}-` } },
        include: { replacement: { select: { id: true } } },
        orderBy: [{ month: 'asc' }, { revision: 'desc' }, { id: 'asc' }],
      });
    });
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown, supersedesId?: string, reason?: string) {
    const data = monthlyPlanInput.parse(input);
    if (supersedesId && data.month.endsWith('-ALL'))
      throw new DomainError('CORRECTION', 'Correct one saved month at a time.');
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      const records = [];
      for (const month of expandPlanMonths(data.month))
        records.push(await this.addWithin(tx, actor, org, siteId, { ...data, month }, supersedesId, reason));
      return records;
    });
  }
  async addWithin(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    supersedesId?: string,
    reason?: string,
  ) {
    await this.lock(tx, org);
    await this.access(tx, actor, org, siteId, true);
    const data = monthlyPlanInput.parse(input);
    if (data.month.endsWith('-ALL')) throw new DomainError('MONTH', 'Expand all months before saving.');
    const why = supersedesId ? correctionReason.parse(reason) : null;
    if (supersedesId) uuid.parse(supersedesId);
    const retry = await tx.monthlyPlanVersion.findFirst({
      where: { organisationId: org, requestKey: data.requestKey, month: data.month },
    });
    if (retry) {
      const old = retry.payload as unknown as MonthlyPlanPayload;
      if (
        retry.siteId !== siteId ||
        retry.supersedesId !== (supersedesId ?? null) ||
        retry.correctionReason !== why ||
        Object.entries(data).some(([key, v]) => old[key as keyof typeof data] !== v)
      )
        throw new DomainError('RETRY_CONFLICT', 'This request key was used for different values.', 409);
      return retry;
    }
    const previous = supersedesId
      ? await tx.monthlyPlanVersion.findFirst({
          where: { id: supersedesId, organisationId: org, siteId, replacement: { is: null } },
        })
      : null;
    if (
      supersedesId &&
      (!previous ||
        previous.kind !== data.kind ||
        previous.fuel !== data.fuel ||
        previous.month !== data.month ||
        previous.unit !== data.unit)
    )
      throw new DomainError(
        'CORRECTION',
        'Reload and correct the current version without changing its kind, fuel, month or unit.',
        409,
      );
    if (
      !supersedesId &&
      (await tx.monthlyPlanVersion.findFirst({
        where: {
          organisationId: org,
          siteId,
          kind: data.kind,
          fuel: data.fuel,
          month: data.month,
          ...(data.kind === 'TARGET' ? { unit: data.unit } : {}),
        },
      }))
    )
      throw new DomainError('DUPLICATE', 'A record already exists. Append a correction instead.', 409);
    const codes = data.energyUseCodes
      .split(';')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (new Set(codes).size !== codes.length) throw new DomainError('END_USE', 'Remove duplicate end-use codes.');
    const uses = await tx.siteEnergyUse.findMany({
      where: { organisationId: org, siteId, fuel: data.fuel, code: { in: codes } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    if (uses.length !== codes.length)
      throw new DomainError('END_USE', 'Use registered end-use codes for this site and fuel, separated by semicolons.');
    const payload: MonthlyPlanPayload = {
      ...data,
      normalizedKwh: new Decimal(data.energy).times(data.conversionFactor).toString(),
      conversionVersion: 'monthly-plan-explicit-v1',
      energyUses: uses,
    };
    const record = await tx.monthlyPlanVersion.create({
      data: {
        organisationId: org,
        siteId,
        kind: data.kind,
        fuel: data.fuel,
        month: data.month,
        unit: data.unit,
        requestKey: data.requestKey,
        payload: payload as unknown as Prisma.InputJsonValue,
        revision: previous ? previous.revision + 1 : 1,
        supersedesId: previous?.id,
        correctionReason: why,
        authorId: actor.userId,
      },
    });
    await this.audit(tx, actor, org, 'monthly_plan.saved', record.id, {
      siteId,
      kind: data.kind,
      month: data.month,
      revision: record.revision,
    });
    return record;
  }
}
