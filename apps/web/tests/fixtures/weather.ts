import { weatherDates } from '../../src/domain/weather';
// Explicitly synthetic provider data. Used only by tests, never by the application.
export function syntheticWeather(year: number) {
  const dates = weatherDates(year).dates;
  return {
    latitude: 51.5,
    longitude: -0.125,
    elevation: 20,
    timezone: 'Europe/London',
    utc_offset_seconds: 0,
    daily_units: { time: 'iso8601', temperature_2m_mean: '°C', daylight_duration: 's' },
    daily: { time: dates, temperature_2m_mean: dates.map(() => 10), daylight_duration: dates.map(() => 43200) },
  };
}
