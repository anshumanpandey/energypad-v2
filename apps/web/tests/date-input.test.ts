import { describe, expect, it } from 'vitest';
import { displayDate, parseDateInput } from '../src/domain/date-input';
describe('day/month/year date fields', () => {
  it('converts unambiguous dates without timezone shifts', () => {
    expect(parseDateInput('05/04/2024')).toBe('2024-04-05');
    expect(displayDate('2024-04-05')).toBe('05/04/2024');
    expect(parseDateInput('29/02/2024')).toBe('2024-02-29');
    expect(parseDateInput('01/01/0099')).toBe('0099-01-01');
  });
  it.each(['29/02/2023', '31/04/2024', '01/13/2024', '00/01/2024', '01/01/0000', '2024-01-01', '1/1/2024'])(
    'rejects invalid or incorrectly formatted input %s',
    (text) => {
      expect(parseDateInput(text)).toBeNull();
    },
  );
  it('preserves local time and allows clearing', () => {
    expect(parseDateInput('25/10/2026 01:30', true)).toBe('2026-10-25T01:30');
    expect(displayDate('2026-10-25T01:30')).toBe('25/10/2026 01:30');
    expect(parseDateInput('25/10/2026 24:00', true)).toBeNull();
    expect(parseDateInput('25/10/2026 12:60', true)).toBeNull();
    expect(parseDateInput('')).toBe('');
    expect(displayDate('')).toBe('');
  });
});
