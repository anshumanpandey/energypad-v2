import { expect, it, vi } from 'vitest';
vi.mock('../src/server/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'test-user' } })) }));
import { api } from '../src/server/http';
import { WorkbookCellError } from '../src/domain/workbook-errors';
it('returns all cell errors as structured no-store validation feedback', async () => {
  const cellErrors = Array.from({ length: 55 }, (_, i) => ({
    sheet: 'Import',
    cell: `A${i + 2}`,
    row: i + 2,
    column: 1,
    message: 'Excel error cell.',
  }));
  const response = await api(new Request('http://localhost/api/import'), async () => {
    throw new WorkbookCellError(cellErrors);
  });
  expect(response.status).toBe(400);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await response.json()).cellErrors).toEqual(cellErrors);
});

import { meterInput } from '../src/domain/sites';
it('identifies all invalid meter fields in the API response', async () => {
  const response = await api(new Request('http://localhost/api/meter'), async () =>
    meterInput.parse({ code: '', name: 'x', fuel: 'GAS', unit: 'kWh' }),
  );
  const result = await response.json();
  expect(response.status).toBe(400);
  expect(result.title).toContain('name: Meter name must contain at least 2 characters.');
  expect(result.fieldErrors).toEqual({
    code: 'Meter code is required.',
    name: 'Meter name must contain at least 2 characters.',
  });
});
