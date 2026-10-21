import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { MonthlyCarbonGauge } from '../src/components/monthly-carbon-gauge';
const points = ['100', '50', '0', null].map((actual, index) => ({ month: `2024-0${index + 1}`, actual }));
it.each([
  ['01', '100.00 kg', 'rotate(90 320 255)'],
  ['02', '50.00 kg', 'rotate(0 320 255)'],
  ['03', '0.00 kg', 'rotate(-90 320 255)'],
])('renders the selected carbon value and scale for %s', (month, value, rotation) => {
  const html = renderToStaticMarkup(
    createElement(MonthlyCarbonGauge, { points, history: points, period: `2024-${month}` }),
  );
  expect(html).toContain(`Selected month carbon gauge: ${value}`);
  expect(html).toContain(rotation);
  if (month === '02') {
    expect(html).toContain('1.72 kg/day');
    expect(html).toContain('-50.00%');
  }
});
it.each(['04', '12', ''])('keeps absent or unavailable month %s unavailable', (month) => {
  const html = renderToStaticMarkup(
    createElement(MonthlyCarbonGauge, { points, history: points, period: month ? `2024-${month}` : '' }),
  );
  expect(html).toContain('Selected month carbon gauge: N/A');
  expect(html).not.toContain('data-testid="monthly-carbon-needle"');
});
