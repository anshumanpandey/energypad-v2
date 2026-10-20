import type { WastePreview } from './waste-preview';

export async function allSitesWaste(
  sites: { id: string; name: string }[],
  year: number | undefined,
  drivers: string[],
  load: (siteId: string, year: number | undefined, drivers: string[]) => Promise<WastePreview>,
) {
  // Keep database work bounded while retaining each site's independently fitted model.
  const results: { site: (typeof sites)[number]; preview: WastePreview }[] = [];
  for (const site of sites) results.push({ site, preview: await load(site.id, year, drivers) });
  const years = [...new Set(results.flatMap(({ preview }) => preview.years))].sort((a, b) => b - a);
  const selectedYear = year ?? years[0] ?? new Date().getUTCFullYear();
  for (const result of results) {
    if (result.preview.year !== selectedYear) result.preview = await load(result.site.id, selectedYear, drivers);
  }
  const throughMonths = results.flatMap(({ preview }) =>
    preview.weather?.required && preview.weather.throughMonth ? [preview.weather.throughMonth] : [],
  );
  const preview: WastePreview = {
    year: selectedYear,
    years,
    drivers,
    method: 'All sites · independent site models',
    weather: { required: throughMonths.length > 0, ready: true, throughMonth: throughMonths.sort()[0] },
    meters: results.flatMap(({ site, preview }) =>
      preview.meters.map((meter) => ({
        ...meter,
        siteId: site.id,
        name: `${site.name} · ${meter.name}`,
      })),
    ),
  };
  return {
    preview,
    weatherSites: results
      .filter(({ preview }) => preview.weather?.required && !preview.weather.ready)
      .map(({ site }) => site),
  };
}
