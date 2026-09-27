import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { workerHealthy } from '../src/server/weather/worker-health';
import { testDatabase } from './test-database';

const database = await testDatabase();
const directory = await mkdtemp(path.join(tmpdir(), 'energiepad-worker-smoke-'));
const file = path.join(directory, 'health.json');
const frozen = process.env.TEST_WORKER_FREEZE === 'true';
const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/weather-worker.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: frozen ? 'postgresql://unused:unused@127.0.0.1:1/unreachable' : database.databaseUrl,
    APP_WRITE_FREEZE: frozen ? 'true' : 'false',
    WEATHER_WORKER_HEALTH_FILE: file,
    OPEN_METEO_API_KEY: '',
  },
  stdio: 'ignore',
});
const exited = once(child, 'exit');
try {
  const deadline = Date.now() + 20_000;
  while (!(await workerHealthy(file, Date.now(), (pid) => process.kill(pid, 0), frozen)) && Date.now() < deadline) {
    assert.equal(child.exitCode, null, 'Worker exited before reporting progress');
    await delay(100);
  }
  assert.equal(await workerHealthy(file, Date.now(), (pid) => process.kill(pid, 0), frozen), true);
  const first = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(first.status, frozen ? 'paused' : 'idle');
  assert.equal(first.pid, child.pid);
  await delay(2200);
  assert.ok(JSON.parse(await readFile(file, 'utf8')).updatedAt > first.updatedAt);
  child.kill('SIGTERM');
  const stopTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
  const [code, signal] = await exited;
  clearTimeout(stopTimer);
  assert.equal(code, 0);
  assert.equal(signal, null);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'stopped');
  assert.equal(await workerHealthy(file, Date.now(), (pid) => process.kill(pid, 0), frozen), false);
  console.log(
    `✓ weather worker records ${frozen ? 'paused' : 'idle'} progress and stops cleanly; no provider jobs or calls`,
  );
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
  await database.cleanup();
  await rm(directory, { recursive: true, force: true });
}
