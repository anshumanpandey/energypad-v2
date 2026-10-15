import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ChartMonthDays } from '../src/components/chart-month-days';

it.each([
  ['2024-02', 29],
  ['2025-02', 28],
  ['2025-04', 30],
  ['2025-01', 31],
  ['2100-02', 28],
])('shows calendar days for %s', (month, days) => {
  expect(renderToStaticMarkup(createElement(ChartMonthDays, { month }))).toContain(`${days} days`);
});
it('does not invent a month when all months are selected', () => {
  expect(renderToStaticMarkup(createElement(ChartMonthDays, {}))).toBe('');
});

it('divides monthly values by calendar days, preserving negative values and zero', () => {
  const html = renderToStaticMarkup(
    createElement(ChartMonthDays, {
      month: '2024-02',
      averages: [
        { label: 'Energy', value: 290, unit: 'kWh' },
        { label: 'Cost', value: -58, unit: '£' },
        { label: 'Wastage', value: 0, unit: 'kWh' },
      ],
    }),
  );
  expect(html).toContain('10.00 kWh/day');
  expect(html).toContain('-2.00 £/day');
  expect(html).toContain('0.00 kWh/day');
});
it('keeps missing daily averages unavailable', () => {
  const html = renderToStaticMarkup(
    createElement(ChartMonthDays, {
      month: '2025-01',
      averages: [{ label: 'Energy', value: null, unit: 'kWh' }],
    }),
  );
  expect(html).toContain('Unavailable');
  expect(html).not.toContain('0.00');
});
