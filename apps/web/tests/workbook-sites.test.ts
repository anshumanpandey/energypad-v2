import { expect, it } from 'vitest';
import { matchingWorkbookSites } from '../src/domain/workbook-sites';
it('resolves names and legacy references without choosing ambiguous sites', () => {
  const sites = [
    { name: 'Main Building', code: 'SITE-1' },
    { name: 'Annex', code: 'SITE-2' },
  ];
  expect(matchingWorkbookSites(sites, ' main BUILDING ')).toEqual([sites[0]]);
  expect(matchingWorkbookSites(sites, 'site-2')).toEqual([sites[1]]);
  expect(matchingWorkbookSites(sites, 'Unknown')).toEqual([]);
  expect(matchingWorkbookSites([...sites, { name: 'Main Building', code: 'SITE-3' }], 'Main Building')).toHaveLength(2);
});
