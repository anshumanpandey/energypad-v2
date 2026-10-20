import { expect, it, vi } from 'vitest';
import { allSitesWaste } from '../src/domain/analysis/all-sites-waste';
import { aggregateWasteRows } from '../src/domain/analysis/waste-gauge';
import type { WastePreview } from '../src/domain/analysis/waste-preview';

const sites = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];
function preview(site: string, year: number, variance: number | null = 10): WastePreview {
  return {
    year,
    years: [year],
    drivers: ['HDD'],
    method: 'test',
    meters: [
      {
        id: `${site}-meter`,
        name: 'Electricity',
        fuel: 'ELECTRICITY',
        issues: [],
        downloadable: true,
        rows: [{ month: `${year}-01`, actual: 100, expected: 110, adjusted: 110, variance, cost: variance, note: '' }],
      },
    ],
  };
}
it('aligns every site to the latest shared year and preserves site download identities', async () => {
  const load = vi.fn(async (site: string, year?: number) => preview(site, year ?? (site === 'a' ? 2024 : 2025)));
  const result = await allSitesWaste(sites, undefined, ['HDD'], load);
  expect(result.preview.year).toBe(2025);
  expect(result.preview.years).toEqual([2025, 2024]);
  expect(load).toHaveBeenCalledWith('a', 2025, ['HDD']);
  expect(result.preview.meters.map((m) => [m.siteId, m.name])).toEqual([
    ['a', 'Alpha · Electricity'],
    ['b', 'Beta · Electricity'],
  ]);
  expect(aggregateWasteRows(result.preview.meters.map((m) => m.rows))[0]).toMatchObject({
    actual: 200,
    variance: 20,
    cost: 20,
  });
});
it('keeps incomplete totals unavailable and identifies sites needing weather', async () => {
  const result = await allSitesWaste(sites, 2023, [], async (site, year) => ({
    ...preview(site, year!, site === 'a' ? 10 : null),
    weather: { required: true, ready: site === 'a', throughMonth: site === 'a' ? '2023-06' : '2023-05' },
  }));
  expect(result.preview.year).toBe(2023);
  expect(result.preview.drivers).toEqual([]);
  expect(result.weatherSites).toEqual([sites[1]]);
  expect(result.preview.weather?.throughMonth).toBe('2023-05');
  expect(aggregateWasteRows(result.preview.meters.map((m) => m.rows))[0]).toMatchObject({
    actual: 200,
    variance: null,
    cost: null,
  });
});
it('does not silently omit a site whose load fails', async () => {
  await expect(
    allSitesWaste(sites, 2025, [], async () => {
      throw new Error('Access denied');
    }),
  ).rejects.toThrow('Access denied');
});
