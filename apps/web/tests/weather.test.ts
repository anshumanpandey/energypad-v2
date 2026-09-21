import { it, expect } from 'vitest';
import { weatherConfigurationInput, weatherDates, aggregateWeather } from '../src/domain/weather';
import { OpenMeteoProvider, validateWeatherResponse } from '../src/server/weather/provider';
import { syntheticWeather } from './fixtures/weather';
const settings = {
  latitude: '51.5',
  longitude: '-0.12',
  timezone: 'Europe/London',
  heatingBase: '15',
  coolingBase: '20',
  source: 'Synthetic test policy',
};
const request = { ...settings, ...weatherDates(2020) };
it('requires explicit coordinates, timezone, bases and a complete available year', () => {
  expect(
    weatherConfigurationInput.parse({ ...settings, latitude: '0', longitude: '0', heatingBase: '0' }).latitude,
  ).toBe('0');
  for (const patch of [
    { latitude: '' },
    { latitude: '91' },
    { longitude: '-181' },
    { timezone: 'auto' },
    { timezone: 'bad' },
    { heatingBase: '' },
    { coolingBase: '51' },
    { latitude: '1.1234567' },
  ])
    expect(weatherConfigurationInput.safeParse({ ...settings, ...patch }).success).toBe(false);
  expect(weatherDates(2020).dates).toHaveLength(366);
  expect(() => weatherDates(1939)).toThrow();
  expect(() => weatherDates(2025, new Date('2026-01-06'))).toThrow();
  expect(weatherDates(2025, new Date('2026-01-08')).dates).toHaveLength(365);
});
it('calculates monthly degree days and daylight, keeping true zero', () => {
  const result = validateWeatherResponse(
    syntheticWeather(2020),
    request,
    'https://archive-api.open-meteo.com/v1/archive',
  );
  const months = aggregateWeather(result.days, settings);
  expect(months).toHaveLength(12);
  expect(months[1]).toEqual({
    month: '2020-02',
    days: 29,
    meanTemperature: 10,
    heatingDegreeDays: 145,
    coolingDegreeDays: 0,
    daylightHours: 348,
  });
  expect(
    aggregateWeather([{ date: '2020-01-01', meanTemperature: 25, daylightSeconds: 0 }], settings)[0],
  ).toMatchObject({ heatingDegreeDays: 0, coolingDegreeDays: 5, daylightHours: 0 });
});
it('rejects missing, duplicate, reordered, null and wrong-unit weather days', () => {
  const bad = [
    (v: ReturnType<typeof syntheticWeather>) => v.daily.time.pop(),
    (v: ReturnType<typeof syntheticWeather>) => {
      v.daily.time[1] = v.daily.time[0];
    },
    (v: ReturnType<typeof syntheticWeather>) => v.daily.time.reverse(),
    (v: ReturnType<typeof syntheticWeather>) => {
      v.daily_units.temperature_2m_mean = '°F';
    },
    (v: ReturnType<typeof syntheticWeather>) => {
      v.timezone = 'America/Bogota';
    },
    (v: ReturnType<typeof syntheticWeather>) => {
      v.latitude = 0;
    },
    (v: ReturnType<typeof syntheticWeather>) => {
      v.daily.daylight_duration[0] = 86401;
    },
    (v: ReturnType<typeof syntheticWeather>) => {
      v.daily.temperature_2m_mean[0] = Number.NaN;
    },
  ];
  for (const mutate of bad) {
    const value = syntheticWeather(2020);
    mutate(value);
    expect(() => validateWeatherResponse(value, request, 'endpoint')).toThrow();
  }
  const value = syntheticWeather(2020);
  expect(() =>
    validateWeatherResponse(
      { ...value, daily: { ...value.daily, temperature_2m_mean: [null, ...value.daily.temperature_2m_mean.slice(1)] } },
      request,
      'endpoint',
    ),
  ).toThrow();
});
it('pins ERA5, bounds requests, redacts secrets and requires a commercial key in production', async () => {
  let calls = 0;
  const provider = new OpenMeteoProvider({
    production: true,
    apiKey: 'private-test-key',
    fetch: async (url, init) => {
      calls++;
      const parsed = new URL(String(url));
      expect(parsed.hostname).toBe('customer-archive-api.open-meteo.com');
      expect(parsed.searchParams.get('models')).toBe('era5');
      expect(parsed.searchParams.get('timezone')).toBe('Europe/London');
      expect(init?.signal).toBeDefined();
      expect(init?.redirect).toBe('error');
      return Response.json(syntheticWeather(2020));
    },
  });
  const result = await provider.fetchYear(request);
  expect(calls).toBe(1);
  expect(JSON.stringify(result)).not.toContain('private-test-key');
  await expect(
    new OpenMeteoProvider({
      production: true,
      fetch: () => {
        throw Error('must not call');
      },
    }).fetchYear(request),
  ).rejects.toThrow('not configured');
  for (const transport of [
    async () => {
      throw Error('url with private-test-key');
    },
    async () => new Response('private-test-key', { status: 429 }),
    async () => new Response('invalid json'),
    async () => new Response('x'.repeat(1_000_001)),
  ]) {
    await expect(new OpenMeteoProvider({ fetch: transport }).fetchYear(request)).rejects.not.toThrow(
      'private-test-key',
    );
  }
});
