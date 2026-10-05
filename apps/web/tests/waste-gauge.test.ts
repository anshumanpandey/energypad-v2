import { expect, it } from 'vitest';
import { aggregateWasteRows, wasteGauge, type WasteChartRow } from '../src/domain/analysis/waste-gauge';
const row = (month: string, adjusted: number | null, variance: number | null): WasteChartRow => ({
  month,
  actual: 100,
  adjusted,
  variance,
  cost: null,
});

it('weights three-month savings by total expected energy rather than averaging monthly percentages', () => {
  const result = wasteGauge([row('2025-03', 300, 30), row('2025-01', 100, 10), row('2025-02', 200, -20)]);
  expect(result.months).toEqual(['2025-01', '2025-02', '2025-03']);
  expect(result.percentage).toBeCloseTo((20 / 600) * 100);
});
it('uses the selected month as the end of the three-month window across year boundaries', () => {
  const result = wasteGauge(
    [row('2024-11', 100, -20), row('2024-12', 100, -20), row('2025-01', 100, -20), row('2025-02', 100, 50)],
    '2025-01',
  );
  expect(result.months).toEqual(['2024-11', '2024-12', '2025-01']);
  expect(result.percentage).toBe(-20);
});
it('does not substitute earlier calculated months for a missing latest-month calculation', () => {
  expect(
    wasteGauge([row('2025-01', 100, 10), row('2025-02', 100, 10), row('2025-03', 100, null)]).percentage,
  ).toBeNull();
});
it('requires consecutive months and a positive expected total', () => {
  expect(wasteGauge([row('2025-01', 100, 10), row('2025-03', 100, 10)]).percentage).toBeNull();
  expect(wasteGauge([row('2025-01', 0, 0), row('2025-02', 0, 0), row('2025-03', 0, 0)]).percentage).toBeNull();
  expect(wasteGauge([]).percentage).toBeNull();
});
it('reports zero and out-of-scale negative percentages without clipping the calculation', () => {
  expect(wasteGauge(['01', '02', '03'].map((month) => row(`2025-${month}`, 100, 0))).percentage).toBe(0);
  expect(wasteGauge(['01', '02', '03'].map((month) => row(`2025-${month}`, 100, -200))).percentage).toBe(-200);
});
it('combines selected meters without treating incomplete values as zero', () => {
  const rows = aggregateWasteRows([
    [{ ...row('2025-03', 100, 10), cost: 2 }],
    [{ ...row('2025-03', 200, -20), cost: 0 }],
  ]);
  expect(rows[0]).toMatchObject({ actual: 200, adjusted: 300, variance: -10, cost: 2 });
  const missing = aggregateWasteRows([[row('2025-02', 100, 10), row('2025-03', 100, 10)], [row('2025-02', 100, 10)]]);
  expect(missing[1]).toMatchObject({ actual: null, adjusted: null, variance: null, cost: null, observed: true });
  expect(wasteGauge(missing).months.at(-1)).toBe('2025-03');
  expect(wasteGauge(missing).percentage).toBeNull();
});
