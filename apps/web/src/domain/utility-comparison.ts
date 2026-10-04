import type { UtilityGraphRow, UtilityCostTarget } from './utility-graphs';
export function sumUtilityAmounts(values: (string | null)[]) {
  if (!values.length || values.some((v) => v === null)) return null;
  const parts = values.map((value) => {
    const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value!);
    if (!match) throw new Error('Invalid utility amount');
    const scale = (match[2]?.length ?? 0) - Number(match[3] ?? 0);
    return {
      coefficient: BigInt(match[1] + (match[2] ?? '')) * 10n ** BigInt(Math.max(0, -scale)),
      scale: Math.max(0, scale),
    };
  });
  const scale = Math.max(...parts.map((p) => p.scale));
  const total = parts.reduce((s, p) => s + p.coefficient * 10n ** BigInt(scale - p.scale), 0n);
  const digits = total.toString().padStart(scale + 1, '0');
  return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
}

export function utilityComparison(rows: UtilityGraphRow[], targets: UtilityCostTarget[], fuel: string) {
  const sum = sumUtilityAmounts;
  const groups = [...new Set(rows.map((r) => `${r.siteId}|${r.month}`))];
  return groups.map((key) => {
    const matching = rows.filter((r) => `${r.siteId}|${r.month}` === key);
    const first = matching[0];
    const plans = targets.filter((t) => t.siteId === first.siteId && t.month === first.month);
    const siteWide = !fuel ? plans.filter((t) => t.fuel === 'ALL') : [];
    const selected = siteWide.length
      ? siteWide
      : plans.filter((t) => matching.some((r) => r.fuel === t.fuel || (r.fuel === 'DIESEL' && t.fuel === 'OIL')));
    const complete =
      siteWide.length === 1 ||
      (!siteWide.length &&
        matching.every(
          (r) => selected.filter((t) => t.fuel === r.fuel || (r.fuel === 'DIESEL' && t.fuel === 'OIL')).length === 1,
        ));
    const currencies = new Set(matching.map((r) => r.currency));
    const targetCurrencies = new Set(selected.map((t) => t.currency));
    return {
      ...first,
      fuel: fuel || 'ALL',
      consumption: sum(matching.map((r) => r.consumption)),
      emissions: sum(matching.map((r) => r.emissions)),
      cost: currencies.size === 1 ? sum(matching.map((r) => r.cost)) : null,
      grossCost: currencies.size === 1 ? sum(matching.map((r) => r.grossCost ?? null)) : null,
      currency: currencies.size === 1 ? first.currency : null,
      targetEnergy: complete ? sum(selected.map((t) => t.energy)) : null,
      targetCarbon: complete ? sum(selected.map((t) => t.carbon ?? null)) : null,
      targetCost: complete && targetCurrencies.size === 1 ? sum(selected.map((t) => t.cost)) : null,
      targetGrossCost: complete && targetCurrencies.size === 1 ? sum(selected.map((t) => t.grossCost ?? null)) : null,
      targetCurrency: targetCurrencies.size === 1 ? (selected[0]?.currency ?? null) : null,
    };
  });
}
