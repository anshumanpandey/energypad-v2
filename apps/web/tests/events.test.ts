import { describe, expect, it } from 'vitest';
import { eventInput, mapEventWorkbook } from '../src/domain/events';
const input = {
  firstDay: '2020-02-01',
  lastDay: '2020-02-29',
  energyUseCode: 'heat',
  eventCode: 'log-01',
  operation: 'Shutdown',
  comments: '<script>not executable</script>\nSource evidence',
  source: 'Maintenance register',
  legacySource: 'export',
  legacyId: 'log-1',
};
describe('operational events', () => {
  it('preserves evidence text and normalizes stable identifiers', () => {
    expect(eventInput.parse(input)).toMatchObject({
      comments: input.comments,
      energyUseCode: 'HEAT',
      eventCode: 'LOG-01',
    });
  });
  it('rejects invalid dates, missing operation/code and unnamespaced IDs', () => {
    for (const change of [
      { firstDay: '2020-02-30' },
      { lastDay: '2020-01-31' },
      { operation: '' },
      { eventCode: '' },
      { comments: 'x'.repeat(4001) },
      { legacySource: '' },
    ])
      expect(eventInput.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('accepts overlapping events while reconciling every row and rejecting duplicate identities', () => {
    const headers = Object.keys(input);
    const rows = Array.from({ length: 24 }, (_, i) => ({
      row: i + 2,
      cells: Object.values({ ...input, eventCode: `EV-${i}`, legacyId: `log-${i}` }),
    }));
    const report = mapEventWorkbook([{ name: 'Events', headers, rows }]);
    expect(report.sourceRows).toBe(24);
    expect(report.records).toHaveLength(24);
    expect(report.issues).toEqual([]);
    rows.push({ ...rows[0], row: 26 });
    expect(mapEventWorkbook([{ name: 'Events', headers, rows }]).issues).toHaveLength(2);
  });
});
