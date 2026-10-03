import { expect, it } from 'vitest';
import { consumptionTargetChart } from '../src/domain/consumption-target-chart';
const months = Array.from({ length: 12 }, (_, i) => ({ month: `2020-${String(i + 1).padStart(2, '0')}`, kwh: '0.1' }));
const plans = months.map((m) => ({
  month: m.month,
  fuel: 'GAS',
  kind: 'TARGET',
  replacement: null,
  payload: { normalizedKwh: '0.2' },
}));
it('uses current targets once per utility, normalized kWh and exact annual totals', () => {
  const result = consumptionTargetChart(
    months,
    ['GAS', 'GAS'],
    [
      ...plans,
      { ...plans[0], replacement: { id: 'new' }, payload: { normalizedKwh: '999' } },
      { ...plans[0], kind: 'MONITORING' },
      { ...plans[0], fuel: 'ELECTRICITY' },
    ],
  );
  expect(result.consumption).toBe('1.2');
  expect(result.target).toBe('2.4');
  expect(result.rows[0].target).toBe('0.2');
});
it('preserves zero and rejects incomplete or ambiguous target coverage instead of summing partial years', () => {
  expect(
    consumptionTargetChart(
      [{ month: '2020-01', kwh: '0' }],
      ['GAS'],
      [{ ...plans[0], payload: { normalizedKwh: '0' } }],
    ).rows[0],
  ).toEqual({ month: '2020-01', consumption: '0', target: '0' });
  expect(consumptionTargetChart(months, ['GAS'], plans.slice(1)).target).toBeNull();
  expect(consumptionTargetChart(months, ['GAS'], [...plans, plans[0]]).rows[0].target).toBeNull();
  expect(consumptionTargetChart(months, ['GAS', 'ELECTRICITY'], plans).target).toBeNull();
  expect(consumptionTargetChart(months, [], plans).target).toBeNull();
  expect(
    consumptionTargetChart(
      months.map((m, i) => ({ ...m, kwh: i ? m.kwh : null })),
      ['GAS'],
      plans,
    ).consumption,
  ).toBeNull();
});
