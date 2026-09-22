import { describe, expect, it } from 'vitest';
import { patternInput, patternWarnings, mapPatternWorkbook } from '../src/domain/patterns';
const input = {
  firstDay: '2020-02-01',
  lastDay: '2020-02-29',
  energyUseCode: 'office',
  daysOnYear: '366',
  temperature: '-5.125',
  temperatureUnit: 'C',
  temperatureContext: 'HEATING',
  source: 'Legacy pattern review',
  legacySource: 'export',
  legacyId: 'pattern-01',
};
describe('operating patterns', () => {
  it('preserves recorded days/setpoints and flags annual-period discrepancies', () => {
    const parsed = patternInput.parse(input);
    expect(parsed.daysOnYear).toBe('366');
    expect(parsed.temperature).toBe('-5.125');
    expect(parsed.energyUseCode).toBe('OFFICE');
    expect(patternWarnings(parsed)).toHaveLength(1);
  });
  it('keeps missing and zero distinct without guessing units or heating context', () => {
    const parsed = patternInput.parse({
      ...input,
      daysOnYear: '0',
      temperature: '0',
      temperatureUnit: 'UNKNOWN',
      temperatureContext: 'UNKNOWN',
    });
    expect(patternWarnings(parsed)[0]).toContain('unresolved');
    expect(
      patternWarnings(
        patternInput.parse({
          ...input,
          daysOnYear: null,
          temperature: null,
          temperatureUnit: 'UNKNOWN',
          temperatureContext: 'UNKNOWN',
        }),
      ),
    ).toHaveLength(2);
  });
  it('rejects invalid dates, fractional days, missing unit/context and unsupported precision', () => {
    for (const change of [
      { firstDay: '2020-02-30' },
      { lastDay: '2020-01-31' },
      { daysOnYear: '367' },
      { daysOnYear: '-1' },
      { daysOnYear: '1.5' },
      { temperature: '12.0001' },
      { temperatureUnit: 'K' },
      { temperature: null },
    ])
      expect(patternInput.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('reconciles all rows and reports duplicates/overlap', () => {
    const headers = Object.keys(input);
    const rows = Array.from({ length: 24 }, (_, i) => ({
      row: i + 2,
      cells: Object.values({ ...input, energyUseCode: `USE${i}`, legacyId: `p-${i}` }),
    }));
    const report = mapPatternWorkbook([{ name: 'Patterns', headers, rows }]);
    expect(report.sourceRows).toBe(24);
    expect(report.records).toHaveLength(24);
    expect(report.issues).toEqual([]);
    expect(report.records[0].warnings).toHaveLength(1);
    rows.push({ ...rows[0], row: 26 });
    expect(mapPatternWorkbook([{ name: 'Patterns', headers, rows }]).issues).toHaveLength(2);
  });
});
