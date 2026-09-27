import { describe, it, expect } from 'vitest';
import { safeAuthCallback } from '../src/domain/auth-callback';
const id = '12345678-1234-4123-8123-123456789abc';
const report = `/retained-reports/${id}/${id}/${id}`;
describe('authentication return destinations', () => {
  it('preserves only known invitation and retained report links', () => {
    expect(safeAuthCallback(report)).toBe(report);
    const invite = `/invite/${'a'.repeat(64)}`;
    expect(safeAuthCallback(invite)).toBe(invite);
  });
  it.each([
    null,
    {},
    '',
    '/',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    `${report}?callbackUrl=https://evil.example`,
    `${report}#fragment`,
    `${report}/../login`,
    report.replace('retained-reports', '%72etained-reports'),
    '/retained-reports/a/b/c',
    `${report}\n`,
    '/org/anything',
  ])('rejects unsafe or unsupported destinations %#', (value) => {
    expect(safeAuthCallback(value)).toBe('/');
  });
});
