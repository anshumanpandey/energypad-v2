import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from './fixtures/legacy-energy.json';
import { legacyEnergyBundle } from '../src/server/legacy/energy-input';
import { MigrationEvidence } from '../src/components/migration-evidence';
describe('legacy energy evidence', () => {
  it('retains source fields and strips unknown columns before hashing/persistence', () => {
    const input = structuredClone(fixture);
    const parsed = legacyEnergyBundle.parse({
      ...input,
      tables: {
        ...input.tables,
        UtilityConsumptions: input.tables.UtilityConsumptions.map((r) => ({ ...r, password: 'secret' })),
      },
    });
    expect(parsed.tables.UtilityConsumptions[0]).toEqual(fixture.tables.UtilityConsumptions[0]);
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });
  it('requires explicit semantics and safe source timestamps/precision', () => {
    const bad = structuredClone(fixture);
    bad.tables.UtilityConsumptions[0].created_at = '02/01/2020';
    expect(legacyEnergyBundle.safeParse(bad).success).toBe(false);
    expect(
      legacyEnergyBundle.safeParse({ ...fixture, decisions: { ...fixture.decisions, existingDrivers: 'GUESS' } })
        .success,
    ).toBe(false);
    expect(
      legacyEnergyBundle.safeParse({
        ...fixture,
        tables: {
          ...fixture.tables,
          UtilityConsumptions: fixture.tables.UtilityConsumptions.map((r) => ({
            ...r,
            consumption: Number.MAX_SAFE_INTEGER + 1,
          })),
        },
      }).success,
    ).toBe(false);
  });
  it('renders source zero, unknown dates and discrepancies as escaped evidence', () => {
    const html = renderToStaticMarkup(
      createElement(MigrationEvidence, {
        data: {
          source: 'Export',
          reference: '<script>untrusted</script>',
          original: { vatCost: 0, created_at: null },
          decision: { reason: 'Reviewed original values' },
          reconciliation: { calculatedVatCost: '1', vatDifference: '1' },
        },
      }),
    );
    expect(html).toContain('Supplied VAT amount</dt><dd>0');
    expect(html).toContain('Source created</dt><dd>Unknown');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Difference from supplied VAT: 1');
  });
});
