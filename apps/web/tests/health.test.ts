import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseHealth } from '../src/server/health';

afterEach(() => vi.useRealTimers());

describe('database health', () => {
  it('reports outage and recovery transitions without leaking driver errors', async () => {
    const probe = vi.fn().mockResolvedValue(1);
    const log = vi.fn();
    const health = new DatabaseHealth(probe, log);
    expect(await health.check()).toBe('ok');
    await Promise.resolve();
    probe.mockRejectedValue(new Error('postgres://secret@private-host/customer-data'));
    expect(await health.check()).toBe('unavailable');
    await Promise.resolve();
    expect(await health.check()).toBe('unavailable');
    await Promise.resolve();
    probe.mockResolvedValue(1);
    expect(await health.check()).toBe('ok');
    expect(log.mock.calls.map(([event]) => event)).toEqual([
      { event: 'database_health_changed', status: 'ok' },
      { event: 'database_health_changed', status: 'unavailable' },
      { event: 'database_health_changed', status: 'ok' },
    ]);
  });

  it('bounds hanging checks and shares the outstanding query until it settles', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const probe = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const log = vi.fn();
    const health = new DatabaseHealth(probe, log);
    const first = health.check();
    expect(health.check()).toBe(first);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toBe('unavailable');
    for (let i = 0; i < 20; i++) expect(await health.check()).toBe('unavailable');
    expect(probe).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveBeenCalledTimes(1);
    probe.mockImplementation(async () => {});
    expect(await health.check()).toBe('ok');
    expect(probe).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles synchronous probe errors and broken logging safely', async () => {
    const health = new DatabaseHealth(
      () => {
        throw new Error('private');
      },
      () => {
        throw new Error('log');
      },
    );
    expect(await health.check()).toBe('unavailable');
  });

  it('cleans timers after early failure and consumes late probe rejections', async () => {
    vi.useFakeTimers();
    const health = new DatabaseHealth(async () => {
      throw new Error('private');
    }, vi.fn());
    expect(await health.check()).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    let reject!: (error: Error) => void;
    const late = new DatabaseHealth(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
      vi.fn(),
    );
    const pending = late.check();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBe('unavailable');
    reject(new Error('private'));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
