import { describe, expect, it } from 'vitest';
import { occupancyInput, mapOccupancyWorkbook } from '../src/domain/occupancy';
const input = {
  firstDay: '2020-02-01',
  lastDay: '2020-02-29',
  energyUseCode: 'office',
  regularCount: '0',
  irregularCount: null,
  source: 'Attendance register',
  legacySource: 'reviewed-export',
  legacyId: 'tenant-01',
};
describe('occupancy boundaries', () => {
  it('preserves zero versus unknown and normalizes codes', () => {
    expect(occupancyInput.parse(input)).toMatchObject({
      regularCount: 0,
      irregularCount: null,
      energyUseCode: 'OFFICE',
    });
  });
  it('rejects invalid periods, fractions, missing counts and unnamespaced identities', () => {
    for (const change of [
      { firstDay: '2020-02-30' },
      { lastDay: '2020-01-31' },
      { regularCount: '-1' },
      { regularCount: '1.5' },
      { regularCount: null },
      { legacySource: '' },
    ])
      expect(occupancyInput.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('reconciles every row and reports overlaps without silently truncating', () => {
    const headers = Object.keys(input);
    const rows = Array.from({ length: 24 }, (_, i) => ({
      row: i + 2,
      cells: Object.values({ ...input, energyUseCode: `USE${i}`, legacyId: `id-${i}` }).map((v) => v ?? ''),
    }));
    const preview = mapOccupancyWorkbook([{ name: 'Occupancy', headers, rows }]);
    expect(preview.sourceRows).toBe(24);
    expect(preview.records).toHaveLength(24);
    expect(preview.issues).toEqual([]);
    rows.push({ ...rows[0], row: 26 });
    expect(mapOccupancyWorkbook([{ name: 'Occupancy', headers, rows }]).issues).toHaveLength(2);
  });
});
