import { z } from 'zod';
import { DomainError } from '../../domain/policy';
import { canonicalTimezone } from '../../domain/weather';

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        timezone: z.string(),
        country: z.string(),
        country_code: z.string().length(2),
        population: z.number().optional(),
      }),
    )
    .max(10)
    .optional(),
});
export async function geocodeLocation(
  location: string,
  country: string | null,
  apiKey?: string,
  transport: typeof fetch = fetch,
) {
  const endpoint = apiKey
    ? 'https://customer-geocoding-api.open-meteo.com/v1/search'
    : 'https://geocoding-api.open-meteo.com/v1/search';
  const url = new URL(endpoint);
  const knownCountry = country?.trim().toUpperCase();
  const countryCode =
    knownCountry && ['UK', 'UNITED KINGDOM', 'GREAT BRITAIN', 'ENGLAND', 'SCOTLAND', 'WALES'].includes(knownCountry)
      ? 'GB'
      : knownCountry?.length === 2
        ? knownCountry
        : undefined;
  url.search = new URLSearchParams({
    name: country && !countryCode ? `${location}, ${country}` : location,
    count: '10',
    language: 'en',
    format: 'json',
    ...(countryCode ? { countryCode } : {}),
    ...(apiKey ? { apikey: apiKey } : {}),
  }).toString();
  try {
    const response = await transport(url, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('Geocoding request failed');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No geocoding response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 50000) {
          await reader.cancel();
          throw new Error('Geocoding response exceeds limit');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const data = responseSchema.parse(JSON.parse(raw));
    const match = data.results
      ?.filter(
        (item) =>
          item.name.toLowerCase() === location.trim().toLowerCase() &&
          (!countryCode || item.country_code.toUpperCase() === countryCode),
      )
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
    if (!match)
      throw new DomainError(
        'WEATHER_LOCATION',
        'The uploaded site location could not be matched. Set its city and country in Sites, or configure coordinates in HDD & CDD.',
      );
    return {
      latitude: match.latitude.toFixed(6),
      longitude: match.longitude.toFixed(6),
      timezone: canonicalTimezone(match.timezone),
      label: `${match.name}, ${match.country}`,
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      'WEATHER_LOCATION',
      'The location API could not resolve this site. Retry or configure coordinates in HDD & CDD.',
      502,
    );
  }
}
