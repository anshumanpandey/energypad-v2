import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError } from '../domain/policy';
import { consumptionInput, conversionInput, energyConversions, missingMonths, monthPeriod } from '../domain/energy';

export class EnergyService extends FoundationService {
  async records(actor: Actor, org: string, siteId: string, year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new DomainError('YEAR', 'Choose a valid year.');
    await this.getSite(actor, org, siteId);
    const records = await this.db.consumptionRecord.findMany({
      where: {
        organisationId: org,
        siteId,
        periodStart: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
      },
      orderBy: [{ periodStart: 'desc' }, { meterId: 'asc' }],
    });
    const meters = await this.db.meter.findMany({ where: { organisationId: org, siteId }, orderBy: { code: 'asc' } });
    return {
      records,
      meters,
      conversions: await this.db.unitConversionVersion.findMany({
        where: { organisationId: org, siteId },
        orderBy: { validFrom: 'desc' },
      }),
      coverage: meters
        .filter((m) => !m.archivedAt)
        .map((m) => ({
          meterId: m.id,
          name: m.name,
          missing: missingMonths(
            year,
            records.filter((r) => r.meterId === m.id).map((r) => r.periodStart.toISOString().slice(0, 7)),
          ),
        })),
    };
  }
  async addConversion(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = conversionInput.parse(input);
    const validFrom = monthPeriod(data.firstMonth).start;
    const validUntil = monthPeriod(data.lastMonth).end;
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      const meter = await tx.meter.findFirst({
        where: { id: data.meterId, organisationId: org, siteId, archivedAt: null, site: { archivedAt: null } },
      });
      if (!meter) throw new DomainError('NOT_FOUND', 'This active meter is not available.', 404);
      if (!['m3', 'litre', 'kg'].includes(meter.unit))
        throw new DomainError('FIXED_CONVERSION', 'kWh and MWh use fixed dimensional conversions.');
      if (
        await tx.unitConversionVersion.findFirst({
          where: {
            meterId: meter.id,
            sourceUnit: meter.unit,
            fuel: meter.fuel,
            validFrom: { lt: validUntil },
            validUntil: { gt: validFrom },
          },
        })
      )
        throw new DomainError(
          'CONVERSION_OVERLAP',
          'A conversion already covers part of this period. Choose a non-overlapping period.',
          409,
        );
      const result = await tx.unitConversionVersion.create({
        data: {
          organisationId: org,
          siteId,
          meterId: meter.id,
          sourceUnit: meter.unit,
          fuel: meter.fuel,
          factor: data.factor,
          validFrom,
          validUntil,
          source: data.source,
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'energy.conversion_added', result.id, { siteId, meterId: meter.id });
      return result;
    });
  }
  async add(actor: Actor, org: string, siteId: string, input: unknown) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      return this.insertReading(tx, actor, org, siteId, input);
    });
  }
  protected async insertReading(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    batchId?: string,
  ) {
    const data = await this.prepareReading(tx, actor, org, siteId, input);
    const record = await tx.consumptionRecord.create({ data: { ...data, energyImportId: batchId ?? null } });
    await this.audit(tx, actor, org, 'energy.recorded', record.id, {
      siteId,
      meterId: record.meterId,
      month: record.periodStart.toISOString().slice(0, 7),
      ...(batchId ? { batchId } : {}),
    });
    return record;
  }
  protected async prepareReading(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
  ): Promise<Prisma.ConsumptionRecordUncheckedCreateInput> {
    const data = consumptionInput.parse(input);
    const { start, end } = monthPeriod(data.month);
    const meter = await tx.meter.findFirst({
      where: { id: data.meterId, siteId, organisationId: org, archivedAt: null, site: { archivedAt: null } },
    });
    if (!meter) throw new DomainError('NOT_FOUND', 'This active meter is not available.', 404);
    const standard = energyConversions[meter.unit as keyof typeof energyConversions];
    const version = standard
      ? null
      : await tx.unitConversionVersion.findFirst({
          where: {
            organisationId: org,
            siteId,
            meterId: meter.id,
            fuel: meter.fuel,
            sourceUnit: meter.unit,
            validFrom: { lte: start },
            validUntil: { gte: end },
          },
          orderBy: { validFrom: 'desc' },
        });
    const conversion = standard ?? (version ? { factor: version.factor.toString(), version: version.id } : null);
    if (!conversion)
      throw new DomainError(
        'CONVERSION_REQUIRED',
        'Add a sourced conversion factor covering this meter and month before recording consumption.',
      );
    if (
      await tx.consumptionRecord.findFirst({
        where: { meterId: meter.id, periodStart: { lt: end }, periodEnd: { gt: start } },
      })
    )
      throw new DomainError('PERIOD_CONFLICT', 'This meter already has a reading for this month.', 409);
    const attributes = await tx.siteAttributeHistory.findFirst({
      where: { organisationId: org, siteId, effectiveFrom: { lte: start } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const changed = await tx.siteAttributeHistory.count({
      where: { organisationId: org, siteId, effectiveFrom: { gt: start, lt: end } },
    });
    const qualityFlags = [
      ...(data.estimated ? ['Estimated reading'] : []),
      ...(attributes?.population == null ? ['Missing population'] : []),
      ...(attributes?.weeklyHours == null ? ['Missing weekly operating hours'] : []),
      ...(attributes?.floorArea == null ? ['Missing floor area'] : []),
      ...(changed ? ['Site attributes changed during this month'] : []),
      ...(data.netCost !== null && data.vatPercent === null ? ['VAT unknown; gross cost unavailable'] : []),
    ];
    const quantity = new Prisma.Decimal(data.quantity);
    const netCost = data.netCost === null ? null : new Prisma.Decimal(data.netCost);
    const vatCost =
      netCost !== null && data.vatPercent !== null ? netCost.mul(data.vatPercent).div(100).toDecimalPlaces(3) : null;
    return {
      organisationId: org,
      siteId,
      meterId: meter.id,
      periodStart: start,
      periodEnd: end,
      sourceQuantity: quantity,
      sourceUnit: meter.unit,
      fuel: meter.fuel,
      normalizedKwh: quantity.mul(conversion.factor).toDecimalPlaces(3),
      conversionId: version?.id ?? null,
      conversionFactor: conversion.factor,
      conversionVersion: conversion.version,
      estimated: data.estimated,
      netCost,
      vatPercent: data.vatPercent,
      vatCost,
      grossCost: netCost !== null && vatCost !== null ? netCost.add(vatCost) : null,
      currency: data.currency,
      endUse: data.endUse,
      externalLegacyId: data.externalLegacyId,
      attributeSnapshot: {
        id: attributes?.id ?? null,
        effectiveFrom: attributes?.effectiveFrom.toISOString().slice(0, 10) ?? null,
        population: attributes?.population?.toString() ?? null,
        weeklyHours: attributes?.weeklyHours?.toString() ?? null,
        floorArea: attributes?.floorArea?.toString() ?? null,
        basis: 'start-of-month-v1',
      },
      qualityFlags,
      authorId: actor.userId,
    };
  }
}
