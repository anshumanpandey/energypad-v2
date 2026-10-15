import { expect, it, vi } from 'vitest';
import type { APIRequestContext } from '@playwright/test';
import { createSite } from './helpers/create-site';
const input = { code: 'Leeds', name: 'Leeds' };
const site = { id: 'site-id', ...input };
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
it('recovers a committed site without replaying the write', async () => {
  const c = client();
  c.post.mockRejectedValueOnce(new Error('read ECONNRESET'));
  c.get.mockResolvedValue(response([site]));
  expect(await createSite(c.request, '/sites', input)).toEqual(site);
  expect(c.post).toHaveBeenCalledTimes(1);
});
it('retries only when the site was not saved', async () => {
  const c = client();
  c.post.mockRejectedValueOnce(new Error('read ECONNRESET')).mockResolvedValueOnce(response(site));
  c.get.mockResolvedValue(response([]));
  expect(await createSite(c.request, '/sites', input)).toEqual(site);
  expect(c.post).toHaveBeenCalledTimes(2);
});
it('reconciles a commit racing with the retry', async () => {
  const c = client();
  c.post.mockRejectedValueOnce(new Error('read ECONNRESET')).mockResolvedValueOnce(response({}, 409));
  c.get.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([site]));
  expect(await createSite(c.request, '/sites', input)).toEqual(site);
});
it('checks for a committed site after the final allowed write', async () => {
  const c = client();
  c.post.mockRejectedValue(new Error('read ECONNRESET'));
  c.get
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response([site]));
  expect(await createSite(c.request, '/sites', input)).toEqual(site);
  expect(c.post).toHaveBeenCalledTimes(3);
});
it('rejects conflicting fixtures and application errors', async () => {
  const c = client();
  c.post.mockRejectedValueOnce(new Error('read ECONNRESET'));
  c.get.mockResolvedValue(response([{ ...site, name: 'Different' }]));
  await expect(createSite(c.request, '/sites', input)).rejects.toThrow('Conflicting');
  c.post.mockResolvedValueOnce(response({}, 500));
  await expect(createSite(c.request, '/sites', input)).rejects.toThrow('HTTP 500');
});
it('bounds retries and propagates other failures', async () => {
  const c = client();
  c.post.mockRejectedValue(new Error('read ECONNRESET'));
  c.get.mockResolvedValue(response([]));
  await expect(createSite(c.request, '/sites', input)).rejects.toThrow('ECONNRESET');
  expect(c.post).toHaveBeenCalledTimes(3);
  c.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  await expect(createSite(c.request, '/sites', input)).rejects.toThrow('ECONNREFUSED');
});
