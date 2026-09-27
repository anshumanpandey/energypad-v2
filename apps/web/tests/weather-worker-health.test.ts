import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerProgress, workerHealthy, workerStaleMs } from '../src/server/weather/worker-health';

let directory: string;
let file: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'energiepad-worker-health-'));
  file = path.join(directory, 'progress.json');
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('weather worker progress', () => {
  it('accepts deliberate pause only for a frozen runtime', async () => {
    await new WorkerProgress(file, vi.fn(), () => 1000).record('paused');
    expect(await workerHealthy(file, 1000, () => {}, true)).toBe(true);
    expect(await workerHealthy(file, 1000, () => {}, false)).toBe(false);
    await new WorkerProgress(file, vi.fn(), () => 1000).record('idle');
    expect(await workerHealthy(file, 1000, () => {}, true)).toBe(false);
  });
  it('records private snapshots and emits only state transitions', async () => {
    let now = 1000;
    const log = vi.fn();
    const progress = new WorkerProgress(file, log, () => now);
    await progress.record('starting');
    expect(await workerHealthy(file, now)).toBe(false);
    await progress.record('idle');
    expect(await workerHealthy(file, now)).toBe(true);
    now += 2000;
    await progress.record('idle');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      version: 1,
      pid: process.pid,
      status: 'idle',
      updatedAt: now,
    });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(log.mock.calls.map(([event]) => event)).toEqual([
      { event: 'weather_worker_state', status: 'starting' },
      { event: 'weather_worker_state', status: 'idle' },
    ]);
  });

  it('marks a stalled or clock-invalid loop unhealthy without refreshing it', async () => {
    await new WorkerProgress(file, vi.fn(), () => 1000).record('working');
    expect(await workerHealthy(file, 1000 + workerStaleMs)).toBe(true);
    expect(await workerHealthy(file, 1001 + workerStaleMs)).toBe(false);
    expect(await workerHealthy(file, 999)).toBe(false);
    expect(await workerHealthy(file, Number.NaN)).toBe(false);
    expect(JSON.parse(await readFile(file, 'utf8')).updatedAt).toBe(1000);
  });

  it('rejects a dead worker and identifies failure, recovery and shutdown', async () => {
    const progress = new WorkerProgress(file, vi.fn(), () => 1000);
    await progress.record('working');
    expect(
      await workerHealthy(file, 1000, () => {
        throw new Error('dead');
      }),
    ).toBe(false);
    await progress.record('error');
    expect(await workerHealthy(file, 1000)).toBe(false);
    await progress.record('idle');
    expect(await workerHealthy(file, 1000)).toBe(true);
    await progress.record('stopped');
    expect(await workerHealthy(file, 1000)).toBe(false);
  });

  it('fails closed for missing, malformed, oversized and unexpected snapshots', async () => {
    expect(await workerHealthy(file)).toBe(false);
    for (const value of [
      '{',
      'x'.repeat(1025),
      JSON.stringify({ version: 1, pid: process.pid, status: 'idle', updatedAt: Date.now(), secret: 'private' }),
    ]) {
      await writeFile(file, value);
      expect(await workerHealthy(file)).toBe(false);
    }
  });

  it('does not report progress when snapshot persistence fails', async () => {
    const log = vi.fn();
    await expect(
      new WorkerProgress(path.join(directory, 'missing', 'health.json'), log).record('idle'),
    ).rejects.toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it('runs the deployed CLI with fixed output and meaningful exit status', async () => {
    const command = promisify(execFile);
    const progress = new WorkerProgress(file, vi.fn());
    await progress.record('idle');
    const args = ['--import', 'tsx', 'scripts/weather-worker-health.ts'];
    const options = { env: { ...process.env, WEATHER_WORKER_HEALTH_FILE: file } };
    const success = await command(process.execPath, args, options);
    expect(success.stdout.trim()).toBe('Weather worker progressing.');
    await progress.record('error');
    await expect(command(process.execPath, args, options)).rejects.toMatchObject({
      code: 1,
      stdout: 'Weather worker unavailable or progress stale.\n',
    });
  });
});
