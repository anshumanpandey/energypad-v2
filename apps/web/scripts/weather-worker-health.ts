import { workerHealthy } from '../src/server/weather/worker-health';
import { writesFrozen } from '../src/server/write-freeze';

// Fixed output only: Docker persists health-check output in container metadata.
const healthy = await workerHealthy();
console.log(
  healthy
    ? writesFrozen()
      ? 'Weather worker deliberately paused.'
      : 'Weather worker progressing.'
    : 'Weather worker unavailable or progress stale.',
);
process.exitCode = healthy ? 0 : 1;
