export function matchingWorkbookSites<T extends { name: string; code: string }>(
  sites: readonly T[],
  reference: string,
): T[] {
  const value = reference.trim().toLowerCase();
  return sites.filter((site) => site.name.trim().toLowerCase() === value || site.code.toLowerCase() === value);
}
