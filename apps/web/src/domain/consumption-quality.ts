const attributeWarnings = {
  population: 'Missing population',
  weeklyHours: 'Missing weekly operating hours',
  floorArea: 'Missing floor area',
} as const;

export function latestConsumptionQuality(
  recordedFlags: string[],
  attributes: { population: unknown; weeklyHours: unknown; floorArea: unknown } | null | undefined,
): string[] {
  const warnings = new Set<string>(Object.values(attributeWarnings));
  return [
    ...recordedFlags.filter((flag) => !warnings.has(flag) && flag !== 'Estimated reading'),
    ...Object.entries(attributeWarnings)
      .filter(([field]) => attributes?.[field as keyof typeof attributeWarnings] == null)
      .map(([, warning]) => warning),
  ];
}
