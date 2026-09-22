import { describe, it, expect } from 'vitest';
import fixture from './fixtures/legacy-tariffs.json';
import { previewLegacyTariffs } from '../src/server/legacy/tariff-preview';
const copy = () => structuredClone(fixture);
describe('legacy tariff dry run', () => {
  it('reconciles all rows and explicitly converts minor currency and fractional VAT', () => {
    const result = previewLegacyTariffs(copy());
    expect(result.ready).toBe(true);
    expect(result.plan.catalogs).toHaveLength(2);
    expect(result.plan.siteUses).toHaveLength(1);
    expect(result.plan.tariffs[0].input).toMatchObject({
      currency: 'GBP',
      vatPercent: '20',
      bands: [{ rate: '0.15' }],
    });
    expect(result.ledger.find((r) => r.table === 'BusinessBrands')?.original.rate).toBe('15');
    expect(result.reconciliation.every((t) => !t.unmappedRows)).toBe(true);
    expect(result.inputHash).toBe(previewLegacyTariffs(copy()).inputHash);
  });
  it('discards unknown credential columns from the ledger, plan and hash', () => {
    const input = copy();
    Object.assign(input.tables.FuelSources[0], { password: 'discard-secret', apiKey: 'discard-secret' });
    const result = previewLegacyTariffs(input);
    expect(JSON.stringify(result)).not.toContain('discard-secret');
    expect(result.inputHash).toBe(previewLegacyTariffs(copy()).inputHash);
  });
  it('blocks missing decisions, dangling references and unused source bands', () => {
    const missing = copy();
    missing.decisions.tariffs = [];
    expect(previewLegacyTariffs(missing).ready).toBe(false);
    const broken = copy();
    broken.tables.FuelUses[0].fuelSourceId = 99;
    expect(previewLegacyTariffs(broken).ready).toBe(false);
    const unused = copy();
    unused.tables.BusinessBrands.push({ ...unused.tables.BusinessBrands[0], id: 'extra' });
    expect(previewLegacyTariffs(unused).reconciliation.find((t) => t.table === 'BusinessBrands')?.unmappedRows).toBe(1);
  });
  it('blocks duplicate source IDs, codes and ambiguous site associations', () => {
    const duplicate = copy();
    duplicate.tables.FuelSources.push({ ...duplicate.tables.FuelSources[0] });
    expect(previewLegacyTariffs(duplicate).ready).toBe(false);
    const code = copy();
    code.tables.FuelSources.push({ ...code.tables.FuelSources[0], id: 8 });
    code.decisions.fuels.push({ ...code.decisions.fuels[0], legacyId: 8 });
    expect(previewLegacyTariffs(code).issues.some((i) => i.code === 'CATALOG_CODE')).toBe(true);
    const alias = copy();
    alias.tables.BusinessFuelUses.push({ ...alias.tables.BusinessFuelUses[0], id: 8 });
    alias.decisions.associations.push({ ...alias.decisions.associations[0], legacyId: 8, code: 'ALIAS' });
    expect(previewLegacyTariffs(alias).issues.some((i) => i.code === 'ASSOCIATION_ALIAS')).toBe(true);
  });
  it('rejects unsafe identifiers and blocks overlapping or imprecise pricing', () => {
    const unsafe = copy();
    unsafe.tables.FuelSources[0].id = Number.MAX_SAFE_INTEGER + 1;
    expect(previewLegacyTariffs(unsafe).ready).toBe(false);
    const overlap = copy();
    overlap.tables.BusinessBrands.push({ ...overlap.tables.BusinessBrands[0], id: 'second' });
    overlap.decisions.tariffs[0].bands.push({ ...overlap.decisions.tariffs[0].bands[0], legacyId: 'second' });
    expect(previewLegacyTariffs(overlap).ready).toBe(false);
    const precision = copy();
    precision.tables.BusinessBrands[0].rate = '0.0000001';
    expect(previewLegacyTariffs(precision).ready).toBe(false);
  });
  it('preserves zero and source strings without guessing meaning', () => {
    const input = copy();
    input.tables.BusinessBrands[0].rate = '0';
    input.tables.BusinessFuelsPricing[0].vat = '0';
    const report = previewLegacyTariffs(input);
    expect(report.ready).toBe(true);
    expect(report.plan.tariffs[0].input.bands[0].rate).toBe('0');
    expect(report.plan.tariffs[0].input.vatPercent).toBe('0');
    input.decisions.tariffs[0].bands[0].endTime = '01:00';
    expect(previewLegacyTariffs(input).inputHash).not.toBe(report.inputHash);
  });
});
