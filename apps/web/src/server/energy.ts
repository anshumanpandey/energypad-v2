import { Prisma, type ConsumptionRecord } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import {
  consumptionInput,
  conversionInput,
  energyConversions,
  missingMonths,
  monthPeriod,
  readingCorrectionInput,
  conversionCorrectionInput,
} from '../domain/energy';

export class EnergyService extends FoundationService {
  async records(actor: Actor, org: string, siteId: string, year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new DomainError('YEAR', 'Choose a valid year.');
    await this.getSite(actor, org, siteId);
    const records = await this.db.consumptionRecord.findMany({
      where: {
        organisationId: org,
        siteId,
        replacement: { is: null },
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
        include: { replacement: { select: { id: true } } },
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
  async addConversion(
    actor: Actor,
    org: string,
    siteId: string,
    input: unknown,
    supersedesId?: string,
    reason?: string,
  ) {
    const data = conversionInput.parse(input);
    const validFrom = monthPeriod(data.firstMonth).start;
    const validUntil = monthPeriod(data.lastMonth).end;
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      const previous = supersedesId
        ? await tx.unitConversionVersion.findFirst({
            where: { id: uuid.parse(supersedesId), organisationId: org, siteId, replacement: { is: null } },
          })
        : null;
      if (supersedesId && !previous)
        throw new DomainError(
          'STALE_REVISION',
          'This factor is unavailable or has already been corrected. Reload before trying again.',
          409,
        );
      if (previous && previous.meterId !== data.meterId)
        throw new DomainError('CORRECTION_SCOPE', 'A correction must keep the same meter.');
      const meter = await tx.meter.findFirst({
        where: {
          id: data.meterId,
          organisationId: org,
          siteId,
          ...(previous ? {} : { archivedAt: null }),
          site: { archivedAt: null },
        },
      });
      if (!meter) throw new DomainError('NOT_FOUND', 'This active meter is not available.', 404);
      const sourceUnit = previous?.sourceUnit ?? meter.unit,
        fuel = previous?.fuel ?? meter.fuel;
      if (!['m3', 'litre', 'kg'].includes(sourceUnit))
        throw new DomainError('FIXED_CONVERSION', 'kWh and MWh use fixed dimensional conversions.');
      if (
        await tx.unitConversionVersion.findFirst({
          where: {
            meterId: meter.id,
            sourceUnit,
            fuel,
            replacement: { is: null },
            ...(previous ? { id: { not: previous.id } } : {}),
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
          sourceUnit,
          fuel,
          ...(previous ? { supersedesId: previous.id, revision: previous.revision + 1, correctionReason: reason } : {}),
          factor: data.factor,
          validFrom,
          validUntil,
          source: data.source,
          authorId: actor.userId,
        },
      });
      await this.audit(
        tx,
        actor,
        org,
        previous ? 'energy.conversion_corrected' : 'energy.conversion_added',
        result.id,
        {
          siteId,
          meterId: meter.id,
          ...(previous ? { supersedesId: previous.id, reason, revision: result.revision } : {}),
        },
      );
      return result;
    });
  }
  async correctConversion(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const data = conversionCorrectionInput.parse(input);
    return this.addConversion(actor, org, siteId, data.conversion, id, data.reason);
  }
  async correctReading(actor: Actor, org: string, siteId: string, id: string, input: unknown) {
    const data = readingCorrectionInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.membership(actor, org, 'organisation:update', tx);
      const previous = await tx.consumptionRecord.findFirst({
        where: { id: uuid.parse(id), organisationId: org, siteId, replacement: { is: null } },
      });
      if (!previous)
        throw new DomainError(
          'STALE_REVISION',
          'This reading is unavailable or has already been corrected. Reload before trying again.',
          409,
        );
      if (
        previous.meterId !== data.reading.meterId ||
        previous.periodStart.toISOString().slice(0, 7) !== data.reading.month ||
        previous.externalLegacyId !== data.reading.externalLegacyId
      )
        throw new DomainError(
          'CORRECTION_SCOPE',
          'Keep the original meter, month and legacy reference when correcting a reading.',
        );
      const prepared = await this.prepareReading(tx, actor, org, siteId, data.reading, {
        previous,
        useLatestConversion: data.useLatestConversion,
      });
      const result = await tx.consumptionRecord.create({
        data: {
          ...prepared,
          supersedesId: previous.id,
          revision: previous.revision + 1,
          correctionReason: data.reason,
          energyImportId: previous.energyImportId,
        },
      });
      await this.audit(tx, actor, org, 'energy.corrected', result.id, {
        siteId,
        meterId: previous.meterId,
        supersedesId: previous.id,
        reason: data.reason,
        revision: result.revision,
        useLatestConversion: data.useLatestConversion,
      });
      return result;
    });
  }
  async readingHistory(actor: Actor, org: string, siteId: string, id: string) {
    await this.getSite(actor, org, siteId);
    const record = await this.db.consumptionRecord.findFirst({
      where: { id: uuid.parse(id), organisationId: org, siteId },
    });
    if (!record) throw new DomainError('NOT_FOUND', 'This reading is not available.', 404);
    return this.db.consumptionRecord.findMany({
      where: { organisationId: org, siteId, meterId: record.meterId, periodStart: record.periodStart },
      orderBy: { revision: 'desc' },
    });
  }
  async conversionHistory(actor: Actor, org: string, siteId: string, id: string) {
    await this.getSite(actor, org, siteId);
    const record = await this.db.unitConversionVersion.findFirst({
      where: { id: uuid.parse(id), organisationId: org, siteId },
    });
    if (!record) throw new DomainError('NOT_FOUND', 'This factor is not available.', 404);
    const rows = await this.db.unitConversionVersion.findMany({
      where: { organisationId: org, siteId, meterId: record.meterId },
    });
    let root = record;
    while (root.supersedesId) root = rows.find((row) => row.id === root.supersedesId)!;
    const history = [root];
    let next = rows.find((row) => row.supersedesId === root.id);
    while (next) {
      history.push(next);
      next = rows.find((row) => row.supersedesId === next!.id);
    }
    return history.reverse();
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
    correction?: { previous: ConsumptionRecord; useLatestConversion: boolean },
  ): Promise<Prisma.ConsumptionRecordUncheckedCreateInput> {
    const data = consumptionInput.parse(input);
    const { start, end } = monthPeriod(data.month);
    const previous = correction?.previous;
    const meter = await tx.meter.findFirst({
      where: {
        id: data.meterId,
        siteId,
        organisationId: org,
        ...(previous ? {} : { archivedAt: null }),
        site: { archivedAt: null },
      },
    });
    if (!meter) throw new DomainError('NOT_FOUND', 'This active meter is not available.', 404);
    const sourceUnit = previous?.sourceUnit ?? meter.unit,
      fuel = previous?.fuel ?? meter.fuel;

    let energyUseId = previous?.energyUseId ?? null;
    let energyUseSnapshot = previous?.energyUseSnapshot ?? null;
    if (data.energyUseCode !== undefined) {
      const use = data.energyUseCode
        ? await tx.siteEnergyUse.findFirst({
            where: { organisationId: org, siteId, code: data.energyUseCode },
            include: { fuelCatalog: true, endUseCatalog: true },
          })
        : null;
      if (data.energyUseCode && (!use || use.fuel !== fuel))
        throw new DomainError('END_USE_SCOPE', 'Choose a registered end use in this site matching the reading fuel.');
      energyUseId = use?.id ?? null;
      energyUseSnapshot = use
        ? {
            id: use.id,
            code: use.code,
            name: use.name,
            fuel: use.fuel,
            fuelCatalog: use.fuelCatalog
              ? {
                  id: use.fuelCatalog.id,
                  code: use.fuelCatalog.code,
                  name: use.fuelCatalog.name,
                  color: use.fuelCatalog.color,
                  revision: use.fuelCatalog.revision,
                }
              : null,
            endUseCatalog: use.endUseCatalog
              ? {
                  id: use.endUseCatalog.id,
                  code: use.endUseCatalog.code,
                  name: use.endUseCatalog.name,
                  color: use.endUseCatalog.color,
                  revision: use.endUseCatalog.revision,
                }
              : null,
          }
        : null;
    }
    const preserveConversion = previous && !correction?.useLatestConversion;
    const standard = energyConversions[sourceUnit as keyof typeof energyConversions];
    const version =
      standard || preserveConversion
        ? null
        : await tx.unitConversionVersion.findFirst({
            where: {
              organisationId: org,
              siteId,
              meterId: meter.id,
              fuel,
              sourceUnit,
              replacement: { is: null },
              validFrom: { lte: start },
              validUntil: { gte: end },
            },
            orderBy: { validFrom: 'desc' },
          });
    const conversion = preserveConversion
      ? { factor: previous.conversionFactor.toString(), version: previous.conversionVersion }
      : (standard ?? (version ? { factor: version.factor.toString(), version: version.id } : null));
    if (!conversion)
      throw new DomainError(
        'CONVERSION_REQUIRED',
        'Add a sourced conversion factor covering this meter and month before recording consumption.',
      );
    if (
      !previous &&
      (await tx.consumptionRecord.findFirst({
        where: { meterId: meter.id, periodStart: { lt: end }, periodEnd: { gt: start } },
      }))
    )
      throw new DomainError('PERIOD_CONFLICT', 'This meter already has a reading for this month.', 409);
    const attributes = await tx.siteAttributeHistory.findFirst({
      where: { organisationId: org, siteId, effectiveFrom: { lte: start } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const changed = await tx.siteAttributeHistory.count({
      where: { organisationId: org, siteId, effectiveFrom: { gt: start, lt: end } },
    });
    const attributeFlags = previous
      ? (previous.qualityFlags as string[]).filter(
          (flag) => !['Estimated reading', 'VAT unknown; gross cost unavailable'].includes(flag),
        )
      : [
          ...(attributes?.population == null ? ['Missing population'] : []),
          ...(attributes?.weeklyHours == null ? ['Missing weekly operating hours'] : []),
          ...(attributes?.floorArea == null ? ['Missing floor area'] : []),
          ...(changed ? ['Site attributes changed during this month'] : []),
        ];
    const qualityFlags = [
      ...(data.estimated ? ['Estimated reading'] : []),
      ...attributeFlags,
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
      sourceUnit,
      fuel,
      normalizedKwh: quantity.mul(conversion.factor).toDecimalPlaces(3),
      conversionId: preserveConversion ? previous.conversionId : (version?.id ?? null),
      conversionFactor: conversion.factor,
      conversionVersion: conversion.version,
      estimated: data.estimated,
      netCost,
      vatPercent: data.vatPercent,
      vatCost,
      grossCost: netCost !== null && vatCost !== null ? netCost.add(vatCost) : null,
      currency: data.currency,
      endUse: data.endUse,
      energyUseId,
      energyUseSnapshot: energyUseSnapshot === null ? Prisma.DbNull : (energyUseSnapshot as Prisma.InputJsonValue),
      sourceProvenance:
        previous?.sourceProvenance == null ? Prisma.DbNull : (previous.sourceProvenance as Prisma.InputJsonValue),
      externalLegacyId: data.externalLegacyId,
      attributeSnapshot: previous
        ? (previous.attributeSnapshot as Prisma.InputJsonValue)
        : {
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
