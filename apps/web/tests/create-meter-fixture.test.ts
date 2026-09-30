import { describe, expect, it, vi } from 'vitest';
import type { APIRequestContext } from '@playwright/test';
import { createMeter } from './helpers/create-meter';
const input = { code: 'G1', name: 'Gas meter', fuel: 'GAS', unit: 'm3' };
const meter = { id: 'meter-id', ...input };
const response = (body: unknown, status = 200) => ({
  ok: () => status >= 200 && status < 300,
  status: () => status,
  json: async () => body,
});
function client() {
  const post = vi.fn(),
    get = vi.fn();
  return { post, get, request: { post, get } as unknown as APIRequestContext };
}
describe('meter fixture connection recovery', () => {
  it('reuses a committed meter when its response was lost', async () => {
    const c = client();
    c.post.mockRejectedValueOnce(new Error('read ECONNRESET'));
    c.get.mockResolvedValue(response({ meters: [meter] }));
    expect(await createMeter(c.request, '/site', input)).toEqual(meter);
    expect(c.post).toHaveBeenCalledTimes(1);
  });
  it('retries an uncommitted request', async () => {
    const c = client();
    c.post.mockRejectedValueOnce(new Error('read ECONNRESET')).mockResolvedValueOnce(response(meter));
    c.get.mockResolvedValue(response({ meters: [] }));
    expect(await createMeter(c.request, '/site', input)).toEqual(meter);
    expect(c.post).toHaveBeenCalledTimes(2);
  });
  it('reconciles a commit racing with a retry', async () => {
    const c = client();
    c.post.mockRejectedValueOnce(new Error('read ECONNRESET')).mockResolvedValueOnce(response({}, 409));
    c.get.mockResolvedValueOnce(response({ meters: [] })).mockResolvedValueOnce(response({ meters: [meter] }));
    expect(await createMeter(c.request, '/site', input)).toEqual(meter);
  });
  it('does not hide conflicting data or application errors', async () => {
    const c = client();
    c.post.mockRejectedValueOnce(new Error('read ECONNRESET'));
    c.get.mockResolvedValue(response({ meters: [{ ...meter, unit: 'kWh' }] }));
    await expect(createMeter(c.request, '/site', input)).rejects.toThrow('Conflicting');
    c.post.mockResolvedValueOnce(response({}, 503));
    await expect(createMeter(c.request, '/site', input)).rejects.toThrow('HTTP 503');
  });
  it('bounds retries and propagates other network errors', async () => {
    const c = client();
    c.post.mockRejectedValue(new Error('read ECONNRESET'));
    c.get.mockResolvedValue(response({ meters: [] }));
    await expect(createMeter(c.request, '/site', input)).rejects.toThrow('ECONNRESET');
    expect(c.post).toHaveBeenCalledTimes(3);
    c.post.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(createMeter(c.request, '/site', input)).rejects.toThrow('ECONNREFUSED');
  });
});
