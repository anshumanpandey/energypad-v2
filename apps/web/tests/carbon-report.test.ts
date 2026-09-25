import { describe, expect, it } from 'vitest';
import { carbonReportCsv, csvCell, type CarbonReport } from '../src/domain/carbon-report';
const report: CarbonReport = {
  reportVersion: 'carbon-report-v1',
  organisationId: 'org',
  subject: { kind: 'site', id: 'site', name: '=SUM(1,2)' },
  scope: 'SITE_ACTIVE_METERS',
  checkedAt: '2026-09-24T00:00:00.000Z',
  definition: { year: 2020, geography: 'GB', basis: 'LOCATION_BASED' },
  status: 'INCOMPLETE',
  totalKgCO2e: null,
  unit: 'kgCO2e',
  note: 'Historical evidence',
  sites: [
    {
      id: 'site',
      code: 'S',
      name: 'Site, "one"',
      summary: {
        definition: { year: 2020, geography: 'GB', basis: 'LOCATION_BASED' },
        checkedAt: '2026-09-24T00:00:00.000Z',
        status: 'INCOMPLETE',
        totalKgCO2e: null,
        meters: [
          {
            meterId: 'meter',
            name: '@unsafe',
            fuel: 'ELECTRICITY',
            status: 'OUTDATED',
            runId: 'run',
            calculatedAt: '2026-09-23T00:00:00.000Z',
            kgCO2e: null,
            estimatedMonths: 0,
            issue: 'Changed factor',
          },
        ],
      },
    },
  ],
  evidence: [
    {
      id: 'run',
      siteId: 'site',
      algorithmVersion: 'monthly-exact-factor-v1',
      createdAt: '2026-09-23T00:00:00.000Z',
      snapshot: {
        definition: { meterId: 'meter', year: 2020, geography: 'GB', basis: 'LOCATION_BASED', requestKey: 'key' },
        meter: { id: 'meter', name: 'Meter', fuel: 'ELECTRICITY' },
        status: 'COMPLETE',
        totalKgCO2e: '0.123456789123',
        rows: [
          {
            month: '2020-01',
            issue: null,
            kgCO2e: '0.123456789123',
            factor: '0.123456789',
            normalizedKwh: '1.001',
            readingId: 'reading',
            readingRevision: 2,
            conversionVersion: 'fixed-kwh-v1',
            factorId: 'factor',
            factorRevision: 3,
            estimated: true,
            source: '  =HYPERLINK("bad")',
          },
        ],
      },
    },
  ],
};
describe('carbon report exports', () => {
  it('keeps missing totals blank and labels historical monthly evidence', () => {
    const csv = carbonReportCsv(report);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"INCOMPLETE",""');
    expect(csv).toContain('"OUTDATED",""');
    expect(csv).toContain('"SAVED_RESULT","0.123456789123"');
    expect(csv).toContain('METER status determines current coverage');
    expect(csv).toContain('"reading","2","fixed-kwh-v1","factor","3","0.123456789","true"');
    expect(csv).toContain('monthly-exact-factor-v1');
  });
  it('escapes delimiter/quote characters and neutralizes spreadsheet formulas', () => {
    expect(csvCell('Site, "one"')).toBe('"Site, ""one"""');
    for (const value of ['=1+1', '+cmd', '-cmd', '@SUM(A1)', ' \t=1', '\ttext', '\rtext', '\ntext'])
      expect(csvCell(value)).toMatch(/^"'/);
    expect(carbonReportCsv(report)).toContain('"\'=SUM(1,2)"');
    expect(carbonReportCsv(report)).toContain('"\'@unsafe"');
  });
  it('distinguishes an exact zero from unavailable totals', () => {
    expect(csvCell('0')).toBe('"0"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(false)).toBe('"false"');
  });
  it('preserves exact decimal strings and sources in the JSON contract', () => {
    const decoded = JSON.parse(JSON.stringify(report));
    expect(decoded.evidence[0].snapshot.totalKgCO2e).toBe('0.123456789123');
    expect(decoded.evidence[0].snapshot.rows[0].source).toBe('  =HYPERLINK("bad")');
    expect(decoded.totalKgCO2e).toBeNull();
  });
  it('still exports metadata for an empty scope', () => {
    const csv = carbonReportCsv({ ...report, status: 'EMPTY', sites: [], evidence: [] });
    expect(csv).toContain('"EMPTY",""');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
