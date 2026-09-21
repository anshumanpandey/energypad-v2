import 'dotenv/config';
import { setTimeout } from 'node:timers/promises';
import { db } from '../src/server/db';
import { WeatherJobs } from '../src/server/weather/jobs';
import { OpenMeteoProvider } from '../src/server/weather/provider';
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
console.log('Weather worker started.');
try {
  while (!stopping) {
    try {
      if (await jobs.processOne()) continue;
    } catch {
      console.error('Weather worker could not process a job; will retry.');
    }
    await setTimeout(2000, undefined, { signal: idle.signal }).catch(() => {});
  }
} finally {
  await db.$disconnect();
  console.log('Weather worker stopped.');
}
