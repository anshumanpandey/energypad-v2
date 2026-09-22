import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { EnergyService } from '../energy';
import type { Actor } from '../foundation';
import { DomainError, uuid } from '../../domain/policy';
import { monthPeriod } from '../../domain/energy';
import { observationInput } from '../../domain/drivers';
import { legacyEnergyBundle, type LegacyEnergyBundle } from './energy-input';
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, canonical(v)]),
    );
  return value;
}
const hash = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(json(v))))
    .digest('hex');
const decimal = (v: string | number) => new Prisma.Decimal(v);
const sameScope = (a: { siteId: string; fuelSourceId: string; usedInId: string }, b: typeof a) =>
  a.siteId === b.siteId && a.fuelSourceId === b.fuelSourceId && a.usedInId === b.usedInId;
function fail(message: string): never {
  throw new DomainError('MIGRATION', message, 409);
}
function checkDecisions(rows: { id: string }[], decisions: { legacyId: string }[]) {
  if (
    new Set(rows.map((r) => r.id)).size !== rows.length ||
    new Set(decisions.map((d) => d.legacyId)).size !== decisions.length ||
    rows.length !== decisions.length ||
    decisions.some((d) => !rows.some((r) => r.id === d.legacyId))
  )
    fail('Provide exactly one decision per unique source row.');
}
export class LegacyEnergyMigration extends EnergyService {
  private async check(tx: Prisma.TransactionClient, actor: Actor, org: string, b: LegacyEnergyBundle) {
    checkDecisions(b.tables.BusinessFuelsSize, b.decisions.meters);
    checkDecisions(b.tables.UtilityConsumptions, b.decisions.readings);
    const siteMap = new Map<string, string>();
    for (const row of b.tables.BusinessFuelsSize) {
      const site = b.decisions.meters.find((d) => d.legacyId === row.id)!.siteId;
      if (siteMap.has(row.siteId) && siteMap.get(row.siteId) !== site)
        fail('One source site cannot map to several destinations.');
      if ([...siteMap.entries()].some(([key, value]) => key !== row.siteId && value === site))
        fail('Distinct source sites require distinct destinations.');
      siteMap.set(row.siteId, site);
    }
    const issues: { table: string; id: string; message: string }[] = [];
    const meters: {
      original: (typeof b.tables.BusinessFuelsSize)[number];
      decision: (typeof b.decisions.meters)[number];
      snapshots: unknown[];
      reused: boolean;
    }[] = [];
    const readings: {
      original: (typeof b.tables.UtilityConsumptions)[number];
      decision: (typeof b.decisions.readings)[number];
      prepared: Prisma.ConsumptionRecordUncheckedCreateInput;
      reconciliation: {
        suppliedVatCost: string | number | null;
        calculatedVatCost: string | null;
        vatDifference: string | null;
        suppliedTotalCost: string | number | null;
        calculatedTotalCost: string | null;
        costDifference: string | null;
      };
      driverKeys: string[];
    }[] = [];
    const drivers = new Map<
      string,
      {
        siteId: string;
        month: string;
        driver: 'POPULATION' | 'OPERATING_HOURS';
        value: string;
        existingId: string | null;
        sourceRows: string[];
      }
    >();
    const occupied = new Set<string>();
    const seenMeters = new Set<string>();
    for (const original of b.tables.BusinessFuelsSize) {
      const decision = b.decisions.meters.find((d) => d.legacyId === original.id)!;
      try {
        const separator = { SINGLE: null, COMMA: ',', SEMICOLON: ';', NEWLINE: '\n' }[decision.format];
        const tokens = (separator === null ? [original.meters] : original.meters.split(separator)).map((t) => t.trim());
        if (
          tokens.some((t) => !t) ||
          new Set(tokens).size !== tokens.length ||
          tokens.length !== decision.tokens.length ||
          new Set(decision.tokens.map((t) => t.token)).size !== tokens.length ||
          decision.tokens.some((t) => !tokens.includes(t.token))
        )
          fail('Every meter token must be explicitly split and mapped once.');
        const use = await tx.siteEnergyUse.findFirst({
          where: {
            organisationId: org,
            siteId: decision.siteId,
            code: decision.energyUseCode,
            site: { archivedAt: null },
          },
        });
        if (!use) fail('The mapped active site/end use is unavailable.');
        if (
          use.legacySource &&
          (use.legacySource !== b.source ||
            use.fuelLegacyId !== original.fuelSourceId ||
            use.endUseLegacyId !== original.usedInId)
        )
          fail('The source fuel/use identities disagree with the registered end use.');
        const snapshots: unknown[] = [];
        for (const token of decision.tokens) {
          if (seenMeters.has(token.meterId))
            fail('A destination meter cannot represent multiple source meter tokens in this bundle.');
          seenMeters.add(token.meterId);
          const meter = await tx.meter.findFirst({
            where: {
              id: token.meterId,
              organisationId: org,
              siteId: decision.siteId,
              fuel: use.fuel,
              archivedAt: null,
            },
          });
          if (!meter) fail('The mapped meter is unavailable or its site/fuel does not match.');
          snapshots.push({ token: token.token, meter, energyUse: use });
        }
        const prior = await tx.legacyEnergyRow.findUnique({
          where: {
            organisationId_source_table_legacyId: {
              organisationId: org,
              source: b.source,
              table: 'BusinessFuelsSize',
              legacyId: original.id,
            },
          },
        });
        if (prior && hash(prior.evidence) !== hash(json({ original, decision })))
          fail('An existing meter mapping has different source evidence or decisions.');
        meters.push({ original, decision, snapshots, reused: !!prior });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        issues.push({ table: 'BusinessFuelsSize', id: original.id, message: error.message });
      }
    }
    for (const original of b.tables.UtilityConsumptions) {
      const decision = b.decisions.readings.find((d) => d.legacyId === original.id)!;
      try {
        const mapping = meters.find((m) => m.original.id === decision.meterListId);
        if (
          !mapping ||
          !sameScope(original, mapping.original) ||
          !mapping.decision.tokens.some((t) => t.meterId === decision.meterId)
        )
          fail(
            'Choose one explicitly mapped meter in this source site/fuel/use scope; totals cannot be copied to several meters.',
          );
        const siteId = mapping.decision.siteId;
        const key = `${decision.meterId}:${decision.month}`;
        if (occupied.has(key))
          fail(
            'Several source rows map to the same meter/month. Review aggregation or allocation outside this adapter.',
          );
        occupied.add(key);
        if (
          await tx.legacyEnergyRow.findUnique({
            where: {
              organisationId_source_table_legacyId: {
                organisationId: org,
                source: b.source,
                table: 'UtilityConsumptions',
                legacyId: original.id,
              },
            },
          })
        )
          fail('This source consumption row was already migrated.');
        if (
          original.created_at &&
          original.updated_at &&
          +new Date(original.updated_at) < +new Date(original.created_at)
        )
          fail('Source update time precedes creation time. Review the source timestamps.');
        const vat =
          original.vat === null ? null : decimal(original.vat).mul(decision.vatBasis === 'FRACTION' ? 100 : 1);
        if (decision.costBasis === 'GROSS' && original.totalCost !== null && vat === null)
          fail('Gross-to-net conversion requires an explicit VAT rate.');
        const total = original.totalCost === null ? null : decimal(original.totalCost);
        const net =
          total === null
            ? null
            : decision.costBasis === 'NET'
              ? total
              : total.div(decimal(1).add(vat!.div(100))).toDecimalPlaces(3);
        const prepared = await this.prepareReading(tx, actor, org, siteId, {
          meterId: decision.meterId,
          month: decision.month,
          quantity: decimal(original.consumption).toFixed(),
          estimated: decision.estimated,
          netCost: net?.toFixed() ?? null,
          vatPercent: vat?.toFixed() ?? null,
          currency: decision.currency,
          energyUseCode: mapping.decision.energyUseCode,
          endUse: '',
          externalLegacyId: original.id,
        });
        if (prepared.sourceUnit !== decision.sourceUnit)
          fail('The reviewed source unit does not match the destination meter.');
        if (prepared.conversionVersion !== decision.conversionVersion)
          fail('The reviewed conversion version is no longer selected for this meter/month.');
        if (
          decision.factorBasis === 'KWH_PER_SOURCE_UNIT' &&
          (original.conversionFactor === null ||
            !decimal(original.conversionFactor).eq(String(prepared.conversionFactor)))
        )
          fail(
            'The supplied factor does not match the reviewed kWh-per-source-unit conversion. Preserve-only requires an explicit reviewed reason.',
          );
        const calculatedVatCost = prepared.vatCost == null ? null : String(prepared.vatCost);
        const calculatedTotalCost = decision.costBasis === 'NET' ? prepared.netCost : prepared.grossCost;
        const vatDifference =
          original.vatCost === null || calculatedVatCost === null
            ? null
            : decimal(calculatedVatCost).sub(original.vatCost).toFixed();
        const costDifference =
          total === null || calculatedTotalCost == null
            ? null
            : decimal(String(calculatedTotalCost)).sub(total).toFixed();
        const discrepancy =
          (original.vatCost !== null && calculatedVatCost === null) ||
          (vatDifference !== null && !decimal(vatDifference).isZero()) ||
          (total !== null && calculatedTotalCost == null) ||
          (costDifference !== null && !decimal(costDifference).isZero());
        if (discrepancy && !decision.acceptCostDifference)
          fail('Supplied and calculated costs differ or cannot be compared. Review the discrepancy explicitly.');
        if (discrepancy)
          prepared.qualityFlags = [
            ...(prepared.qualityFlags as string[]),
            'Legacy supplied cost/VAT differs from calculated amounts; see migration evidence',
          ];
        if (decision.factorBasis === 'PRESERVE_ONLY')
          prepared.qualityFlags = [
            ...(prepared.qualityFlags as string[]),
            'Legacy conversion factor retained as source evidence; reviewed conversion used',
          ];
        const driverKeys: string[] = [];
        for (const [field, kind, mode] of [
          ['population', 'POPULATION', decision.population],
          ['workingHours', 'OPERATING_HOURS', decision.workingHours],
        ] as const) {
          if (mode === 'PRESERVE_ONLY' || original[field] === null) continue;
          const observation = observationInput.parse({
            month: decision.month,
            driver: kind,
            value: decimal(original[field]).toFixed(),
            source: b.reference,
          });
          const driverKey = `${siteId}:${decision.month}:${kind}`;
          const grouped = drivers.get(driverKey);
          if (grouped && !decimal(grouped.value).eq(observation.value))
            fail(
              'Source rows disagree on the site/month driver. Resolve the conflict; do not sum or choose a row silently.',
            );
          const existing = await tx.driverObservation.findFirst({
            where: {
              organisationId: org,
              siteId,
              month: monthPeriod(decision.month).start,
              driver: kind,
              replacement: { is: null },
            },
          });
          if (existing && (b.decisions.existingDrivers !== 'REUSE_EQUAL' || !existing.value.eq(observation.value)))
            fail('An existing site/month driver conflicts with the reviewed migration policy.');
          drivers.set(driverKey, {
            siteId,
            month: decision.month,
            driver: kind,
            value: observation.value,
            existingId: existing?.id ?? null,
            sourceRows: [...(grouped?.sourceRows ?? []), original.id],
          });
          driverKeys.push(driverKey);
        }
        readings.push({
          original,
          decision,
          prepared,
          reconciliation: {
            suppliedVatCost: original.vatCost,
            calculatedVatCost,
            vatDifference,
            suppliedTotalCost: original.totalCost,
            calculatedTotalCost: calculatedTotalCost == null ? null : String(calculatedTotalCost),
            costDifference,
          },
          driverKeys,
        });
      } catch (error) {
        if (!(error instanceof DomainError) && !(error instanceof z.ZodError)) throw error;
        issues.push({
          table: 'UtilityConsumptions',
          id: original.id,
          message:
            error instanceof DomainError
              ? error.message
              : 'Source values exceed supported precision/ranges or lack required conversion semantics.',
        });
      }
    }
    const totalGroups = new Map<
      string,
      {
        siteId: string;
        unit: string;
        currency: string;
        costBasis: string;
        rows: number;
        sourceQuantity: string;
        normalizedKwh: string;
        suppliedCost: string;
        calculatedCost: string;
        suppliedVat: string;
        calculatedVat: string;
        missingSuppliedCost: number;
        missingCalculatedCost: number;
        missingSuppliedVat: number;
        missingCalculatedVat: number;
      }
    >();
    for (const row of readings) {
      const key = JSON.stringify([
        row.prepared.siteId,
        row.decision.sourceUnit,
        row.decision.currency,
        row.decision.costBasis,
      ]);
      const group = totalGroups.get(key) ?? {
        siteId: row.prepared.siteId,
        unit: row.decision.sourceUnit,
        currency: row.decision.currency,
        costBasis: row.decision.costBasis,
        rows: 0,
        sourceQuantity: '0',
        normalizedKwh: '0',
        suppliedCost: '0',
        calculatedCost: '0',
        suppliedVat: '0',
        calculatedVat: '0',
        missingSuppliedCost: 0,
        missingCalculatedCost: 0,
        missingSuppliedVat: 0,
        missingCalculatedVat: 0,
      };
      group.rows++;
      group.sourceQuantity = decimal(group.sourceQuantity).add(row.original.consumption).toFixed();
      group.normalizedKwh = decimal(group.normalizedKwh).add(String(row.prepared.normalizedKwh)).toFixed();
      for (const [field, missing, value] of [
        ['suppliedCost', 'missingSuppliedCost', row.original.totalCost],
        ['calculatedCost', 'missingCalculatedCost', row.reconciliation.calculatedTotalCost],
        ['suppliedVat', 'missingSuppliedVat', row.original.vatCost],
        ['calculatedVat', 'missingCalculatedVat', row.reconciliation.calculatedVatCost],
      ] as const) {
        if (value === null) group[missing]++;
        else group[field] = decimal(group[field]).add(value).toFixed();
      }
      totalGroups.set(key, group);
    }
    const totals = [...totalGroups.values()];
    const plan = { meters, readings, drivers: [...drivers.entries()] };
    // Actor identity is audit metadata, not a change to the reviewed destination calculation.
    const signaturePlan = {
      ...plan,
      readings: readings.map((r) => ({ ...r, prepared: { ...r.prepared, authorId: undefined } })),
    };
    return {
      adapter: 'legacy-energy-v1' as const,
      organisationId: org,
      inputHash: hash(b),
      targetSignature: hash(signaturePlan),
      ready: !issues.length,
      issues,
      totals,
      reconciliation: {
        meterSourceRows: b.tables.BusinessFuelsSize.length,
        mappedMeterRows: meters.length,
        meterTokens: meters.reduce((n, m) => n + m.decision.tokens.length, 0),
        consumptionSourceRows: b.tables.UtilityConsumptions.length,
        mappedReadings: readings.length,
        driverDestinations: drivers.size,
      },
      plan,
    };
  }
  async preview(actor: Actor, org: string, input: unknown) {
    const b = legacyEnergyBundle.parse(input);
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await this.membership(actor, org, 'organisation:update', tx);
        return this.check(tx, actor, org, b);
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 },
    );
  }
  async apply(actor: Actor, org: string, input: unknown, reviewed: unknown) {
    const b = legacyEnergyBundle.parse(input);
    const approval = z
      .object({
        adapter: z.literal('legacy-energy-v1'),
        organisationId: uuid,
        inputHash: z.string(),
        targetSignature: z.string(),
        ready: z.literal(true),
      })
      .parse(reviewed);
    if (approval.organisationId !== org || approval.inputHash !== hash(b))
      fail('The source/decisions or organisation differ from the reviewed report.');
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, org);
        await this.membership(actor, org, 'organisation:update', tx);
        const previous = await tx.legacyEnergyBatch.findUnique({
          where: { organisationId_inputHash: { organisationId: org, inputHash: hash(b) } },
        });
        if (previous) return { reused: true, batch: previous };
        const report = await this.check(tx, actor, org, b);
        if (!report.ready || approval.targetSignature !== report.targetSignature)
          fail('The destination or prepared calculations changed. Resolve blockers and review a fresh preview.');
        const batch = await tx.legacyEnergyBatch.create({
          data: {
            organisationId: org,
            inputHash: report.inputHash,
            authorId: actor.userId,
            receipt: json({ ...report, source: b.source, reference: b.reference, decisions: b.decisions }),
          },
        });
        const driverTargets = new Map<string, string>();
        for (const [key, d] of report.plan.drivers) {
          let id = d.existingId;
          if (!id) {
            const row = await tx.driverObservation.create({
              data: {
                organisationId: org,
                siteId: d.siteId,
                month: monthPeriod(d.month).start,
                driver: d.driver,
                value: d.value,
                source: b.reference,
                authorId: actor.userId,
              },
            });
            id = row.id;
            await this.audit(tx, actor, org, 'driver.recorded', id, { migrationBatchId: batch.id });
          }
          driverTargets.set(key, id);
        }
        for (const m of report.plan.meters) {
          if (m.reused) continue;
          await tx.legacyEnergyRow.create({
            data: {
              organisationId: org,
              batchId: batch.id,
              source: b.source,
              table: 'BusinessFuelsSize',
              legacyId: m.original.id,
              evidence: json({ original: m.original, decision: m.decision }),
              targets: json(m.snapshots),
            },
          });
        }
        for (const r of report.plan.readings) {
          const sourceProvenance = json({
            batchId: batch.id,
            source: b.source,
            reference: b.reference,
            original: r.original,
            decision: r.decision,
            reconciliation: r.reconciliation,
            driverTargets: r.driverKeys.map((key) => ({ key, id: driverTargets.get(key) })),
          });
          const row = await tx.consumptionRecord.create({ data: { ...r.prepared, sourceProvenance } });
          await tx.legacyEnergyRow.create({
            data: {
              organisationId: org,
              batchId: batch.id,
              source: b.source,
              table: 'UtilityConsumptions',
              legacyId: r.original.id,
              evidence: sourceProvenance,
              targets: json({
                readingId: row.id,
                meterId: row.meterId,
                conversionId: row.conversionId,
                conversionVersion: row.conversionVersion,
                driverTargets: r.driverKeys.map((key) => driverTargets.get(key)),
              }),
            },
          });
          await this.audit(tx, actor, org, 'energy.recorded', row.id, { migrationBatchId: batch.id });
        }
        await this.audit(
          tx,
          actor,
          org,
          'energy.legacy_applied',
          batch.id,
          json(report.reconciliation) as Prisma.InputJsonObject,
        );
        return { reused: false, batch };
      },
      { timeout: 60000 },
    );
  }
}
