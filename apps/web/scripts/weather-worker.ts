import 'dotenv/config';
import { setTimeout } from 'node:timers/promises';
import { db } from '../src/server/db';
import { WeatherJobs } from '../src/server/weather/jobs';
import { OpenMeteoProvider } from '../src/server/weather/provider';
import { WorkerProgress } from '../src/server/weather/worker-health';
import { writesFrozen } from '../src/server/write-freeze';
const jobs = new WeatherJobs(
  db,
  { async send() {} },
  process.env.AUTH_URL ?? 'http://localhost:3100',
  new OpenMeteoProvider({ apiKey: process.env.OPEN_METEO_API_KEY, production: process.env.NODE_ENV === 'production' }),
);
let stopping = false;
const idle = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    idle.abort();
  });
const progress = new WorkerProgress();
try {
  await progress.record('starting');
  while (!stopping) {
    if (writesFrozen()) {
      await progress.record('paused');
      await setTimeout(2000, undefined, { signal: idle.signal }).catch(() => {});
      continue;
    }
    let processed = false;
    try {
      processed = await jobs.processOne();
    } catch {
      await progress.record('error');
      await setTimeout(2000, undefined, { signal: idle.signal }).catch(() => {});
      continue;
    }
    await progress.record(processed ? 'working' : 'idle');
    if (processed) continue;
    await setTimeout(2000, undefined, { signal: idle.signal }).catch(() => {});
  }
} finally {
  try {
    await progress.record('stopped');
  } finally {
    await db.$disconnect();
  }
}
