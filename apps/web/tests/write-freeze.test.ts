import { afterEach, expect, it, vi } from 'vitest';
import { writesFrozen, databaseConnection, assertWritable, freezeResponse } from '../src/server/write-freeze';
vi.mock('../src/server/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'test-user' } })) }));
import { api } from '../src/server/http';
afterEach(() => vi.unstubAllEnvs());
it('fails closed for invalid nonempty operator settings', () => {
  for (const value of ['', 'false']) expect(writesFrozen(value)).toBe(false);
  for (const value of ['true', 'TRUE', 'FALSE', 'yes', '0', ' ']) expect(writesFrozen(value)).toBe(true);
  vi.stubEnv('APP_WRITE_FREEZE', 'true');
  expect(() => assertWritable()).toThrow('Maintenance');
  expect(freezeResponse().status).toBe(503);
});
it('overrides conflicting connection options without changing other URL values', () => {
  const source =
    'postgresql://user:private@localhost/db?sslmode=require&options=-c%20default_transaction_read_only%3Doff';
  const result = new URL(databaseConnection(source, true));
  expect(result.searchParams.get('options')).toBe(
    '-c default_transaction_read_only=off -c default_transaction_read_only=on',
  );
  expect(result.searchParams.get('sslmode')).toBe('require');
  expect(databaseConnection(source, false)).toBe(source);
});
it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('blocks %s before calling application logic', async (method) => {
  vi.stubEnv('APP_WRITE_FREEZE', 'true');
  vi.stubEnv('AUTH_URL', 'http://localhost:3100');
  const work = vi.fn();
  const response = await api(
    new Request('http://localhost:3100/api/test', { method, headers: { origin: 'http://localhost:3100' } }),
    work,
  );
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('60');
  expect(work).not.toHaveBeenCalled();
  expect((await response.json()).code).toBe('WRITE_FREEZE');
});
it('allows authenticated GETs and reports blocked read-side writes without leaking errors', async () => {
  vi.stubEnv('APP_WRITE_FREEZE', 'true');
  const request = new Request('http://localhost:3100/api/test');
  expect((await api(request, async () => ({ ok: true }))).status).toBe(200);
  const failure = await api(request, async () => {
    throw new Error('private database error');
  });
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain('private database error');
});
