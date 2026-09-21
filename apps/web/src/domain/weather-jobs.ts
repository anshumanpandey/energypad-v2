import { DomainError } from './policy';
export const weatherJobAttempts = 3;
export const weatherLeaseMs = 90_000;
export const weatherJobLabels: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Fetching weather',
  RETRY_WAIT: 'Waiting to retry',
  SUCCEEDED: 'Complete',
  FAILED: 'Failed',
};
// Persist only allowlisted messages, never arbitrary exception text or provider URLs.
export function weatherFailure(error: unknown) {
  const code = error instanceof DomainError ? error.code : 'JOB_ERROR';
  const messages: Record<string, string> = {
    WEATHER_PROVIDER: 'The weather provider could not be reached or returned an error.',
    WEATHER_BUSY: 'The weather provider is rate limiting requests.',
    WEATHER_INCOMPLETE: 'The provider returned incomplete or invalid daily weather.',
    WEATHER_TIMEZONE: 'The provider timezone does not match the weather settings.',
    WEATHER_LOCATION: 'The provider grid location does not match the weather settings.',
    WEATHER_ACCESS:
      'The weather API key or plan does not allow this request. Ask an administrator to check provider access.',
    WEATHER_NOT_CONFIGURED: 'The weather provider key is not configured. Ask an administrator to configure it.',
    RATE_LIMIT: 'The organisation weather request limit was reached.',
    NOT_FOUND: 'The site, configuration or requester access is no longer available.',
    FORBIDDEN: 'The requester no longer has permission to enrich weather.',
    UNAUTHENTICATED: 'The requester no longer has verified access.',
    WEATHER_METHOD: 'This job uses an unavailable weather method. Ask an administrator to check the worker version.',
    WEATHER_YEAR: 'This year is not yet available for historical enrichment.',
    JOB_ERROR: 'Weather processing was interrupted by an internal error.',
  };
  return {
    code: messages[code] ? code : 'JOB_ERROR',
    message: messages[code] ?? messages.JOB_ERROR,
    retryable:
      ['WEATHER_PROVIDER', 'WEATHER_BUSY', 'WEATHER_INCOMPLETE', 'RATE_LIMIT', 'JOB_ERROR'].includes(code) ||
      !messages[code],
  };
}
export function weatherRetryDelay(attempts: number, code: string) {
  if (code === 'RATE_LIMIT') return 3600_000;
  if (code === 'WEATHER_BUSY') return 300_000;
  return attempts <= 1 ? 30_000 : 120_000;
}
