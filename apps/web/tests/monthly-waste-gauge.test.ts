import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MonthlyWasteGauge } from '../src/components/monthly-waste-gauge';
const rows = [100, -50, 0, null].map((variance, index) => ({
  month: `2025-0${index + 1}`,
  actual: 200,
  adjusted: 200,
  variance,
  cost: null,
}));
it.each([
  ['01', '+100.00 kWh', 'SAVING', 'rotate(90 320 255)'],
  ['02', '-50.00 kWh', 'WASTE', 'rotate(-45 320 255)'],
  ['03', '0.00 kWh', 'No change', 'rotate(0 320 255)'],
])('shows the exact signed value and needle for month %s', (month, value, direction, rotation) => {
  const html = renderToStaticMarkup(createElement(MonthlyWasteGauge, { rows, month }));
  expect(html).toContain(`Selected month energy gauge: ${value}, ${direction}`);
  expect(html).toContain(rotation);
});
it.each(['04', '12', ''])('does not turn missing month %s into zero', (month) => {
  const html = renderToStaticMarkup(createElement(MonthlyWasteGauge, { rows, month }));
  expect(html).toContain('N/A, Unavailable');
  expect(html).not.toContain('data-testid="monthly-waste-needle"');
});
