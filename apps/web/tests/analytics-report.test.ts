import { describe, it, expect } from 'vitest';
import { analyticsReportCsv, reportFields, reportInput, type AnalyticsReport } from '../src/domain/analytics-report';
import { reportResponse, reportFingerprint } from '../src/server/analytics-reports';
const report: AnalyticsReport = {
  reportVersion: 'analytics-report-v1',
  family: 'energy',
  organisationId: 'org',
  siteId: 'site',
  period: { firstMonth: '2020-01', lastMonth: '2020-12' },
  status: 'INCOMPLETE',
  note: '=HYPERLINK("bad")',
  units: { kwh: 'kWh' },
  summary: { kwh: null },
  rows: [{ month: '2020-01', kwh: '0', complete: false }],
  evidence: { 'a/b~c': { revision: 2, value: '-0.123456789012345678901' }, empty: [], missing: null },
};
describe('analytics report contract', () => {
  it('validates family-specific selectors without silently ignoring irrelevant fields', () => {
    expect(reportInput.parse({ family: 'energy', year: '2020' })).toEqual({ family: 'energy', year: 2020 });
    for (const input of [
      { family: 'other' },
      { family: 'energy', year: 1800 },
      { family: 'energy', year: 2020, runId: 'x' },
      { family: 'savings', runId: 'x' },
      { family: 'baseline' },
    ])
      expect(reportInput.safeParse(input).success).toBe(false);
  });
  it('preserves exact decimals, null, zero, false and nested evidence in long-form CSV', () => {
    const csv = analyticsReportCsv(report);
    expect(csv).toContain('"/summary/kwh","null",""');
    expect(csv).toContain('"/rows/0/kwh","string","0"');
    expect(csv).toContain('"/rows/0/complete","boolean","false"');
    expect(csv).toContain('"/evidence/a~1b~0c/value","string","\'-0.123456789012345678901"');
    expect(csv).toContain('"/note","string","\'=HYPERLINK(""bad"")"');
    expect(reportFields(report.evidence)).toContainEqual({ path: '/empty', value: '[]', type: 'empty' });
  });
  it('returns complete JSON and private attachment headers', async () => {
    const response = reportResponse(report, 'json', reportFingerprint(report));
    expect(await response.json()).toEqual(report);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('X-Report-Fingerprint')).toBe(reportFingerprint(report));
  });
  it('rejects changed previews and unsupported export formats', () => {
    expect(() => reportResponse({ ...report, status: 'COMPLETE' }, 'csv', reportFingerprint(report))).toThrow(
      'Preview the report again',
    );
    expect(() => reportResponse(report, 'pdf')).toThrow('Choose CSV or JSON');
  });
});
