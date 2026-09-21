import { z } from 'zod';
import { DomainError } from '../../domain/policy';
import { canonicalTimezone, type WeatherDay, type WeatherSettings } from '../../domain/weather';
export type WeatherRequest = Pick<WeatherSettings, 'latitude' | 'longitude' | 'timezone'> & {
  start: string;
  end: string;
  dates: string[];
};
export type WeatherResponse = {
  days: WeatherDay[];
  provenance: {
    provider: string;
    dataset: string;
    endpoint: string;
    returnedLatitude: number;
    returnedLongitude: number;
    elevation: number;
    timezone: string;
    utcOffsetSeconds: number;
    retrievedAt: string;
    attribution: string;
    licence: string;
  };
};
export interface WeatherProvider {
  fetchYear(request: WeatherRequest): Promise<WeatherResponse>;
}
const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().finite(),
  timezone: z.string(),
  utc_offset_seconds: z.number().int().min(-50400).max(50400),
  daily_units: z.object({
    time: z.literal('iso8601'),
    temperature_2m_mean: z.literal('°C'),
    daylight_duration: z.literal('s'),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_mean: z.array(z.number().min(-100).max(70)),
    daylight_duration: z.array(z.number().min(0).max(86400)),
  }),
});
export function validateWeatherResponse(raw: unknown, request: WeatherRequest, endpoint: string): WeatherResponse {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new DomainError(
      'WEATHER_INCOMPLETE',
      'The provider returned missing or invalid weather values or units. No weather was saved.',
      502,
    );
  const data = parsed.data;
  let timezone: string;
  try {
    timezone = canonicalTimezone(data.timezone);
  } catch {
    throw new DomainError('WEATHER_TIMEZONE', 'The provider returned an invalid timezone. No weather was saved.', 502);
  }
  if (timezone !== canonicalTimezone(request.timezone))
    throw new DomainError(
      'WEATHER_TIMEZONE',
      'The provider timezone did not match the site configuration. No weather was saved.',
      502,
    );
  // ERA5 uses a coarse grid; tolerate nearby grid centres, never an unrelated location.
  const longitudeDistance = Math.abs(data.longitude - Number(request.longitude));
  const wrappedLongitude = Math.min(longitudeDistance, 360 - longitudeDistance);
  const latitudeScale = Math.cos((Number(request.latitude) * Math.PI) / 180);
  if (Math.abs(data.latitude - Number(request.latitude)) > 1 || wrappedLongitude * latitudeScale > 1)
    throw new DomainError(
      'WEATHER_LOCATION',
      'The provider grid location did not match the requested site. No weather was saved.',
      502,
    );
  const daily = data.daily;
  if (
    daily.time.length !== request.dates.length ||
    daily.temperature_2m_mean.length !== request.dates.length ||
    daily.daylight_duration.length !== request.dates.length ||
    request.dates.some((date, i) => daily.time[i] !== date)
  )
    throw new DomainError(
      'WEATHER_INCOMPLETE',
      'Weather must contain every requested calendar day exactly once. No weather was saved.',
      502,
    );
  return {
    days: daily.time.map((date, i) => ({
      date,
      meanTemperature: daily.temperature_2m_mean[i],
      daylightSeconds: daily.daylight_duration[i],
    })),
    provenance: {
      provider: 'Open-Meteo',
      dataset: 'ERA5',
      endpoint,
      returnedLatitude: data.latitude,
      returnedLongitude: data.longitude,
      elevation: data.elevation,
      timezone: data.timezone,
      utcOffsetSeconds: data.utc_offset_seconds,
      retrievedAt: new Date().toISOString(),
      attribution:
        'Weather data by Open-Meteo / Copernicus ERA5; monthly aggregates and degree days calculated by EnergiePad.',
      licence: 'CC BY 4.0',
    },
  };
}
export class OpenMeteoProvider implements WeatherProvider {
  constructor(private options: { apiKey?: string; production?: boolean; fetch?: typeof fetch } = {}) {}
  async fetchYear(request: WeatherRequest): Promise<WeatherResponse> {
    if (this.options.production && !this.options.apiKey)
      throw new DomainError(
        'WEATHER_NOT_CONFIGURED',
        'Weather service is not configured. An administrator must configure an Open-Meteo subscription with historical API access.',
        503,
      );
    const endpoint = this.options.apiKey
      ? 'https://customer-archive-api.open-meteo.com/v1/archive'
      : 'https://archive-api.open-meteo.com/v1/archive';
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      latitude: request.latitude,
      longitude: request.longitude,
      timezone: request.timezone,
      start_date: request.start,
      end_date: request.end,
      models: 'era5',
      daily: 'temperature_2m_mean,daylight_duration',
      temperature_unit: 'celsius',
      timeformat: 'iso8601',
      cell_selection: 'nearest',
      ...(this.options.apiKey ? { apikey: this.options.apiKey } : {}),
    }).toString();
    try {
      const response = await (this.options.fetch ?? fetch)(url, {
        signal: AbortSignal.timeout(25000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok)
        throw new DomainError(
          [401, 403].includes(response.status)
            ? 'WEATHER_ACCESS'
            : response.status === 429
              ? 'WEATHER_BUSY'
              : response.status >= 500
                ? 'WEATHER_PROVIDER'
                : 'WEATHER_ACCESS',
          response.status === 429
            ? 'The weather provider is busy. Try again later; no weather was saved.'
            : 'The weather provider is unavailable. Try again later; no weather was saved.',
          502,
        );
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1_000_000) {
            await reader.cancel();
            throw new Error('Response exceeds limit');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return validateWeatherResponse(JSON.parse(Buffer.concat(chunks).toString('utf8')), request, endpoint);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      // Never include fetch errors, provider bodies or URLs: they may contain API keys.
      throw new DomainError(
        'WEATHER_PROVIDER',
        'The weather request failed or timed out. Try again; no weather was saved.',
        502,
      );
    }
  }
}
