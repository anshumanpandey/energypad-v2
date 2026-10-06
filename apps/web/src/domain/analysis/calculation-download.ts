export function calculationMethodName(driverCount: number, nra: string) {
  return nra !== 'NONE'
    ? 'Multiple Routine Adjustment + NRA'
    : driverCount === 1
      ? 'Single Routine Adjustment'
      : 'Multiple Routine Adjustment';
}

export function calculationFilename(organisation: string, site: string, year: number, method: string) {
  const slug = (value: string, fallback: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || fallback;
  return `${slug(organisation, 'organisation')}-${slug(site, 'site')}-${year}-${slug(method, 'calculation')}.xlsx`;
}
