import { describe, expect, it } from 'vitest';
import { auditFilters, auditHistoryUrl } from '../src/domain/audit-history';

describe('activity filters', () => {
  it('trims fields and treats empty controls as absent', () => {
    expect(auditFilters.parse({ action: '  organisation.updated ', requestId: '  ' })).toEqual({
      action: 'organisation.updated',
      requestId: undefined,
    });
  });
  it.each([
    { action: 'x'.repeat(101) },
    { action: 'UPPERCASE' },
    { action: '%' },
    { requestId: 'not-a-uuid' },
    { action: ['one', 'two'] },
    { requestId: ['one'] },
    { unknown: 'field' },
  ])('rejects invalid or ambiguous filters: %j', (input) => {
    expect(auditFilters.safeParse(input).success).toBe(false);
  });
  it('preserves active filters when moving between pages', () => {
    const filters = { action: 'organisation.updated', requestId: 'd2129876-889a-4e1f-a045-5c57f2611a76' };
    const url = new URL(auditHistoryUrl('workspace', filters, 'cursor'), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...filters, cursor: 'cursor' });
    expect(auditHistoryUrl('workspace', {})).toBe('/org/workspace/audit');
    expect(new URL(auditHistoryUrl('workspace', filters), 'http://localhost').searchParams.has('cursor')).toBe(false);
  });
});
