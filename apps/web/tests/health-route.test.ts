import { beforeEach, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/db', () => ({ db: { $queryRaw: query } }));
vi.mock('@/server/health', () => import('../src/server/health'));
vi.mock('@/server/write-freeze', () => import('../src/server/write-freeze'));

beforeEach(() => {
  vi.resetModules();
  query.mockReset();
});

it.each([
  { available: true, code: 200, status: 'ok' },
  { available: false, code: 503, status: 'unavailable' },
])('returns a private no-store health response: $code', async ({ available, code, status }) => {
  if (available) query.mockResolvedValue([{ value: 1 }]);
  else query.mockRejectedValue(new Error('postgres://private-secret@private-host'));
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const { GET } = await import('../src/app/api/health/route');
    const response = await GET();
    expect(response.status).toBe(code);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status });
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'database_health_changed', status }));
  } finally {
    log.mockRestore();
  }
});
