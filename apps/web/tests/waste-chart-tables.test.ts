import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { WasteChartTables } from '../src/components/waste-chart-tables';

const rows = [
  { month: '2025-01', actual: 100, adjusted: 120, variance: 20, cost: 10 },
  { month: '2025-02', actual: 100, adjusted: 80, variance: -20, cost: -10 },
  { month: '2025-03', actual: 100, adjusted: 110, variance: 10, cost: 5 },
];
it('renders all chart datasets as tables with selected-month changes and the full gauge window', () => {
  const html = renderToStaticMarkup(
    createElement(WasteChartTables, {
      rows,
      month: '03',
      sort: 'month',
      gaugeMonths: rows.map((row) => ({ month: row.month, value: (row.variance / row.adjusted) * 100 })),
      gaugePercentage: (10 / 310) * 100,
    }),
  );
  expect(html.match(/<table\b/g)).toHaveLength(4);
  expect(html).not.toContain('<svg');
  expect(html.match(/aria-current="date"/g)).toHaveLength(4);
  expect(html.match(/<th scope="row">Jan-25/g)).toHaveLength(4);
  expect(html.match(/<th scope="row">Feb-25/g)).toHaveLength(4);
  expect(html).toContain('Cost (£) table');
  expect(html).toContain('Actual consumption vs wastage table');
  expect(html).toContain('+150.00%');
  expect(html).toContain('+30.00');
  expect(html).toContain('+15.00');
  expect(html).toContain('Jan-25');
  expect(html).toContain('Feb-25');
  expect(html).toContain('Mar-25');
  expect(html).toContain('Three-month total');
  expect(html).toContain('+3.23%');
});
it('preserves unavailable values instead of displaying them as zero', () => {
  const html = renderToStaticMarkup(
    createElement(WasteChartTables, {
      rows: [{ month: '2025-03', actual: null, adjusted: null, variance: null, cost: null }],
      month: '03',
      sort: 'month',
      gaugeMonths: [{ month: '2025-03', value: null }],
      gaugePercentage: null,
    }),
  );
  expect(html).toContain('Unavailable');
  expect(html).not.toContain('<td>0.00</td>');
});
