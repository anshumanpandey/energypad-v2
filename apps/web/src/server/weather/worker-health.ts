import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { writesFrozen } from '../write-freeze';

export const workerHealthPath = process.env.WEATHER_WORKER_HEALTH_FILE ?? '/tmp/energiepad-weather-worker-health.json';
// Longer than a job's 90-second lease. No timer refreshes this while work is stuck.
export const workerStaleMs = 120_000;
const snapshotSchema = z
  .object({
    version: z.literal(1),
    pid: z.number().int().positive(),
    status: z.enum(['starting', 'idle', 'working', 'paused', 'error', 'stopped']),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();
type Snapshot = z.infer<typeof snapshotSchema>;
type Status = Snapshot['status'];

export class WorkerProgress {
  private previous: Status | undefined;
  constructor(
    private readonly file = workerHealthPath,
    private readonly report: (event: { event: 'weather_worker_state'; status: Status }) => void = (event) =>
      console.log(JSON.stringify(event)),
    private readonly now = Date.now,
  ) {}

  async record(status: Status) {
    const snapshot: Snapshot = { version: 1, pid: process.pid, status, updatedAt: this.now() };
    // Readers see either the complete previous snapshot or the complete new one.
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot), { mode: 0o600 });
    await rename(temporary, this.file);
    if (status !== this.previous) {
      this.previous = status;
      this.report({ event: 'weather_worker_state', status });
    }
  }
}

export async function workerHealthy(
  file = workerHealthPath,
  now = Date.now(),
  alive: (pid: number) => void = (pid) => process.kill(pid, 0),
  frozen = writesFrozen(),
): Promise<boolean> {
  try {
    const value = await readFile(file, 'utf8');
    if (value.length > 1024) return false;
    const snapshot = snapshotSchema.parse(JSON.parse(value));
    const age = now - snapshot.updatedAt;
    if (!Number.isFinite(age) || age < 0 || age > workerStaleMs) return false;
    if (frozen ? snapshot.status !== 'paused' : !['idle', 'working'].includes(snapshot.status)) return false;
    alive(snapshot.pid);
    return true;
  } catch {
    return false;
  }
}
