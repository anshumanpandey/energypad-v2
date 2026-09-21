import { it, expect } from 'vitest';
import { DomainError } from '../src/domain/policy';
import { weatherFailure, weatherRetryDelay } from '../src/domain/weather-jobs';
it('classifies retryable failures without retaining arbitrary errors or provider secrets', () => {
  for (const code of ['WEATHER_PROVIDER', 'WEATHER_BUSY', 'WEATHER_INCOMPLETE', 'RATE_LIMIT'])
    expect(weatherFailure(new DomainError(code, 'private-secret')).retryable).toBe(true);
  for (const code of ['WEATHER_ACCESS', 'NOT_FOUND', 'FORBIDDEN', 'WEATHER_NOT_CONFIGURED', 'WEATHER_LOCATION'])
    expect(weatherFailure(new DomainError(code, 'private-secret')).retryable).toBe(false);
  expect(JSON.stringify(weatherFailure(new Error('private-secret')))).not.toContain('private-secret');
  expect(weatherRetryDelay(1, 'WEATHER_PROVIDER')).toBe(30000);
  expect(weatherRetryDelay(2, 'WEATHER_PROVIDER')).toBe(120000);
  expect(weatherRetryDelay(1, 'RATE_LIMIT')).toBe(3600000);
});
