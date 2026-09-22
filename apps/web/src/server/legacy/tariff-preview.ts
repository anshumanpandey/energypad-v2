import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { catalogInput } from '../../domain/energy-catalog';
import { energyUseInput, tariffInput, fuels, rateUnits } from '../../domain/tariffs';
import { DomainError, uuid } from '../../domain/policy';
const id = z
  .union([z.string().trim().min(1).max(160), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
  .transform(String);
const text = z.string().max(500);
const number = z.union([z.string().max(100), z.number().finite()]);
const association = z.object({ id, siteId: id, fuelSourceId: id, usedInId: id });
const schemas = {
  FuelSources: z.object({ id, source: text, colorCode: text }),
  FuelUses: z.object({ id, use: text, fuelSourceId: id }),
  BusinessFuelUses: association,
  UsedInToFuelSourceToSite: association,
  BusinessFuelsPricing: association.extend({ currencyCode: text, vat: number }),
  BusinessBrands: association.extend({ name: text, startTime: text, endTime: text, rate: number, days: text }),
};
export const legacyTables = Object.keys(schemas) as (keyof typeof schemas)[];
type Table = keyof typeof schemas;
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,40}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const legacyTariffBundle = z
  .object({
    source: z.string().trim().min(1).max(100),
    reference: z.string().trim().min(3).max(500),
    tables: z
      .object(
        Object.fromEntries(legacyTables.map((t) => [t, z.array(z.unknown()).max(2000).default([])])) as Record<
          Table,
          z.ZodDefault<z.ZodArray<z.ZodUnknown>>
        >,
      )
      .strict(),
    decisions: z
      .object({
        sites: z.array(z.object({ legacyId: id, targetSiteId: uuid }).strict()).max(2000),
        fuels: z
          .array(z.object({ legacyId: id, code, fuel: z.enum(fuels), color: z.string().optional() }).strict())
          .max(2000),
        endUses: z.array(z.object({ legacyId: id, code, color: z.string() }).strict()).max(2000),
        associations: z
          .array(
            z.object({ table: z.enum(['BusinessFuelUses', 'UsedInToFuelSourceToSite']), legacyId: id, code }).strict(),
          )
          .max(2000),
        tariffs: z
          .array(
            z
              .object({
                legacyId: id,
                firstDay: date,
                lastDay: date,
                timezone: z.string().max(100),
                rateUnit: z.enum(rateUnits),
                taxBasis: z.enum(['NET', 'GROSS']),
                vatBasis: z.enum(['PERCENT', 'FRACTION']),
                rateScale: z.enum(['MAJOR', 'HUNDREDTH']),
                bands: z
                  .array(
                    z
                      .object({
                        legacyId: id,
                        days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
                        startTime: z.string().max(5),
                        endTime: z.string().max(5),
                      })
                      .strict(),
                  )
                  .min(1)
                  .max(32),
              })
              .strict(),
          )
          .max(2000),
      })
      .strict(),
  })
  .strict();
type Catalog = z.output<typeof catalogInput>;
type Use = z.output<typeof energyUseInput>;
type Tariff = z.output<typeof tariffInput>;
export type PreviewIssue = { table: string; id: string; code: string; message: string };
export type LegacyTariffPreview = {
  adapter: 'legacy-tariff-preview-v1';
  source: string;
  inputHash: string;
  ready: boolean;
  issues: PreviewIssue[];
  ledger: { table: Table; id: string; original: Record<string, unknown>; targetKey?: string }[];
  plan: {
    catalogs: { key: string; input: Catalog }[];
    siteUses: { key: string; siteId: string; fuelKey: string; endUseKey: string; input: Use }[];
    tariffs: { key: string; siteId: string; siteUseKey: string; input: Omit<Tariff, 'energyUseId'> }[];
  };
  reconciliation: { table: Table; sourceRows: number; mappedRows: number; unmappedRows: number }[];
  decisions: z.output<typeof legacyTariffBundle>['decisions'];
};
const key = (table: string, id: string) => JSON.stringify([table, id]);
const scope = (row: { siteId: string; fuelSourceId: string; usedInId: string }) =>
  JSON.stringify([row.siteId, row.fuelSourceId, row.usedInId]);
export function previewLegacyTariffs(input: unknown): LegacyTariffPreview {
  const parsed = legacyTariffBundle.safeParse(input);
  if (!parsed.success)
    throw new DomainError(
      'LEGACY_FORMAT',
      'Invalid export or decision manifest. Use the documented bounded JSON format.',
    );
  const b = parsed.data;
  if (!legacyTables.some((t) => b.tables[t].length) || legacyTables.reduce((n, t) => n + b.tables[t].length, 0) > 2000)
    throw new DomainError('LEGACY_LIMIT', 'Use 1–2000 total source rows per dry run.');
  const report: LegacyTariffPreview = {
    adapter: 'legacy-tariff-preview-v1',
    source: b.source,
    inputHash: '',
    ready: false,
    issues: [],
    ledger: [],
    plan: { catalogs: [], siteUses: [], tariffs: [] },
    reconciliation: [],
    decisions: b.decisions,
  };
  const issue = (table: string, id: string, code: string, message: string) =>
    report.issues.push({ table, id, code, message });
  const rows = new Map<Table, Map<string, Record<string, unknown>>>();
  for (const table of legacyTables) {
    const entries = new Map<string, Record<string, unknown>>();
    rows.set(table, entries);
    b.tables[table].forEach((raw, index) => {
      const result = schemas[table].safeParse(raw);
      if (!result.success) {
        issue(table, String(index + 1), 'INVALID_ROW', 'Required source fields are missing or invalid.');
        return;
      }
      const row = result.data;
      const original = Object.fromEntries(Object.keys(row).map((f) => [f, (raw as Record<string, unknown>)[f]]));
      report.ledger.push({ table, id: row.id, original });
      if (entries.has(row.id)) {
        issue(table, row.id, 'DUPLICATE_ID', 'Duplicate source ID in this table.');
        return;
      }
      entries.set(row.id, row);
    });
  }
  const get = <T extends Table>(table: T, id: string) =>
    rows.get(table)!.get(id) as z.output<(typeof schemas)[T]> | undefined;
  const bind = (table: Table, id: string, targetKey: string) => {
    const r = report.ledger.find((v) => v.table === table && v.id === id);
    if (r) r.targetKey = targetKey;
  };
  const decisions = <T extends { legacyId: string }>(values: T[], table: Table) => {
    const m = new Map<string, T>();
    for (const v of values) {
      if (m.has(v.legacyId))
        issue('decisions', v.legacyId, 'DUPLICATE_DECISION', 'Each source row requires one decision.');
      if (!get(table, v.legacyId))
        issue('decisions', v.legacyId, 'UNKNOWN_DECISION', 'A decision references a missing source row.');
      m.set(v.legacyId, v);
    }
    return m;
  };
  const fuelDec = decisions(b.decisions.fuels, 'FuelSources'),
    useDec = decisions(b.decisions.endUses, 'FuelUses'),
    tariffDec = decisions(b.decisions.tariffs, 'BusinessFuelsPricing');
  const siteMap = new Map<string, string>();
  for (const v of b.decisions.sites) {
    if (siteMap.has(v.legacyId) || [...siteMap.values()].includes(v.targetSiteId))
      issue('sites', v.legacyId, 'SITE_MAP', 'Site mappings must be one-to-one.');
    siteMap.set(v.legacyId, v.targetSiteId);
  }
  const catalogCodes = new Set<string>();
  const addCatalog = (table: 'FuelSources' | 'FuelUses', rowId: string, data: unknown) => {
    const result = catalogInput.safeParse(data);
    if (!result.success) {
      issue(table, rowId, 'CATALOG_VALUES', 'Review the catalog label, code, fuel, source and hex colour.');
      return;
    }
    const identity = key(result.data.kind, result.data.code);
    if (catalogCodes.has(identity)) {
      issue(table, rowId, 'CATALOG_CODE', 'Two rows map to the same catalog code.');
      return;
    }
    catalogCodes.add(identity);
    const targetKey = key(table, rowId);
    report.plan.catalogs.push({ key: targetKey, input: result.data });
    bind(table, rowId, targetKey);
  };
  for (const [rowId] of rows.get('FuelSources')!) {
    const r = get('FuelSources', rowId)!,
      d = fuelDec.get(rowId);
    if (!d) {
      issue('FuelSources', rowId, 'FUEL_DECISION', 'Choose a stable code and supported fuel explicitly.');
      continue;
    }
    addCatalog('FuelSources', rowId, {
      kind: 'FUEL',
      code: d.code,
      fuel: d.fuel,
      name: r.source,
      color: d.color ?? r.colorCode,
      source: b.reference,
      legacySource: b.source,
      legacyId: rowId,
    });
  }
  for (const [rowId] of rows.get('FuelUses')!) {
    const r = get('FuelUses', rowId)!,
      d = useDec.get(rowId),
      fuel = report.plan.catalogs.find((c) => c.key === key('FuelSources', r.fuelSourceId));
    if (!d || !fuel) {
      issue('FuelUses', rowId, 'END_USE_DECISION', 'Resolve the parent fuel, end-use code and colour.');
      continue;
    }
    addCatalog('FuelUses', rowId, {
      kind: 'END_USE',
      code: d.code,
      fuel: fuel.input.fuel,
      name: r.use,
      color: d.color,
      source: b.reference,
      legacySource: b.source,
      legacyId: rowId,
    });
  }
  const associationMap = new Map<string, string>();
  for (const table of ['BusinessFuelUses', 'UsedInToFuelSourceToSite'] as const) {
    const dec = decisions(
      b.decisions.associations.filter((d) => d.table === table),
      table,
    );
    for (const [rowId] of rows.get(table)!) {
      const r = get(table, rowId)!,
        d = dec.get(rowId),
        siteId = siteMap.get(r.siteId);
      const fuelKey = key('FuelSources', r.fuelSourceId),
        endUseKey = key('FuelUses', r.usedInId);
      const fuel = report.plan.catalogs.find((c) => c.key === fuelKey),
        endUse = report.plan.catalogs.find((c) => c.key === endUseKey);
      if (!d || !siteId || !fuel || !endUse || get('FuelUses', r.usedInId)?.fuelSourceId !== r.fuelSourceId) {
        issue(
          table,
          rowId,
          'ASSOCIATION_SCOPE',
          'Resolve the owned site, matching source fuel/end use and association code.',
        );
        continue;
      }
      if (
        associationMap.has(scope(r)) ||
        report.plan.siteUses.some((u) => u.siteId === siteId && u.input.code === d.code)
      ) {
        issue(
          table,
          rowId,
          'ASSOCIATION_ALIAS',
          'Multiple associations map to the same site/use or code; review aliases explicitly.',
        );
        continue;
      }
      const value = energyUseInput.parse({
        code: d.code,
        name: endUse.input.name,
        fuel: fuel.input.fuel,
        source: b.reference,
        legacySource: b.source,
        fuelLegacyId: r.fuelSourceId,
        endUseLegacyId: r.usedInId,
        associationLegacyId: rowId,
        associationLegacyTable: table,
      });
      const targetKey = key(table, rowId);
      report.plan.siteUses.push({ key: targetKey, siteId, fuelKey, endUseKey, input: value });
      associationMap.set(scope(r), targetKey);
      bind(table, rowId, targetKey);
    }
  }
  const usedBands = new Set<string>();
  for (const [rowId] of rows.get('BusinessFuelsPricing')!) {
    const r = get('BusinessFuelsPricing', rowId)!,
      d = tariffDec.get(rowId),
      siteUseKey = associationMap.get(scope(r)),
      siteId = siteMap.get(r.siteId);
    if (!d || !siteUseKey || !siteId) {
      issue(
        'BusinessFuelsPricing',
        rowId,
        'PRICING_DECISION',
        'Resolve the association, dates, timezone, tax basis and rate units.',
      );
      continue;
    }
    try {
      const bands = d.bands.map((choice) => {
        const band = get('BusinessBrands', choice.legacyId);
        if (!band || scope(band) !== scope(r) || usedBands.has(choice.legacyId)) throw new Error('band scope');
        return {
          name: band.name,
          days: choice.days,
          startTime: choice.startTime,
          endTime: choice.endTime,
          rate: new Prisma.Decimal(band.rate).div(d.rateScale === 'HUNDREDTH' ? 100 : 1).toFixed(),
          legacyId: band.id,
        };
      });
      if (new Set(d.bands.map((v) => v.legacyId)).size !== d.bands.length) throw new Error('duplicate band');
      const mapped = tariffInput.parse({
        energyUseId: '00000000-0000-4000-8000-000000000000',
        name: 'Legacy tariff',
        firstDay: d.firstDay,
        lastDay: d.lastDay,
        currency: r.currencyCode,
        rateUnit: d.rateUnit,
        taxBasis: d.taxBasis,
        vatPercent: new Prisma.Decimal(r.vat).mul(d.vatBasis === 'FRACTION' ? 100 : 1).toFixed(),
        timezone: d.timezone,
        source: b.reference,
        legacySource: b.source,
        pricingLegacyId: r.id,
        bands,
      });
      if (
        report.plan.tariffs.some(
          (t) =>
            t.siteUseKey === siteUseKey && t.input.firstDay <= mapped.lastDay && mapped.firstDay <= t.input.lastDay,
        )
      )
        throw new Error('period overlap');
      const { energyUseId, ...value } = mapped;
      void energyUseId;
      const targetKey = key('BusinessFuelsPricing', rowId);
      report.plan.tariffs.push({ key: targetKey, siteId, siteUseKey, input: value });
      bind('BusinessFuelsPricing', rowId, targetKey);
      for (const choice of d.bands) {
        usedBands.add(choice.legacyId);
        bind('BusinessBrands', choice.legacyId, targetKey);
      }
    } catch {
      issue(
        'BusinessFuelsPricing',
        rowId,
        'TARIFF_VALUES',
        'Review rate/VAT precision and scale, dates, band ownership, unique bands, weekdays and time/period overlaps.',
      );
    }
  }
  for (const table of legacyTables) {
    const mappedRows = report.ledger.filter((r) => r.table === table && r.targetKey).length;
    const sourceRows = b.tables[table].length;
    report.reconciliation.push({ table, sourceRows, mappedRows, unmappedRows: sourceRows - mappedRows });
    for (const r of report.ledger.filter((r) => r.table === table && !r.targetKey))
      if (!report.issues.some((i) => i.table === table && i.id === r.id))
        issue(table, r.id, 'UNMAPPED', 'Source row has no mapped destination.');
  }
  report.inputHash = createHash('sha256')
    .update(JSON.stringify({ source: b.source, reference: b.reference, ledger: report.ledger, decisions: b.decisions }))
    .digest('hex');
  report.ready = !report.issues.length && report.reconciliation.every((r) => r.unmappedRows === 0);
  return report;
}
