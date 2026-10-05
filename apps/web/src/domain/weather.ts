import { z } from 'zod';
import { DomainError } from './policy';
export const weatherMethod = 'daily-mean-degree-days-v1';
export const canonicalTimezone = (zone: string) =>
  new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
const decimal = (min: number, max: number, places: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^-?\\d{1,3}(\\.\\d{1,${places}})?$`), `Use up to ${places} decimal places.`)
    .refine((v) => Number(v) >= min && Number(v) <= max, `Enter a value between ${min} and ${max}.`);
export const weatherConfigurationInput = z
  .object({
    latitude: decimal(-90, 90, 6),
    longitude: decimal(-180, 180, 6),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((v) => {
        try {
          canonicalTimezone(v);
          return true;
        } catch {
          return false;
        }
      }, 'Enter an IANA timezone, such as Europe/London.')
      .transform((v) => canonicalTimezone(v)),
    heatingBase: decimal(-50, 50, 3),
    coolingBase: decimal(-50, 50, 3),
    source: z.string().trim().min(3, 'Record the source of these coordinates and base temperatures.').max(500),
  })
  .strict();
export type WeatherSettings = z.infer<typeof weatherConfigurationInput>;
export const enrichmentInput = z
  .object({ configurationId: z.uuid(), year: z.number().int().min(1940).max(2199) })
  .strict();
export function weatherDates(year: number, now = new Date()) {
  if (!Number.isInteger(year) || year < 1940 || year > 2199)
    throw new DomainError('WEATHER_YEAR', 'Weather coverage starts in 1940. Choose a completed calendar year.');
  const start = `${year}-01-01`,
    end = `${year}-12-31`;
  // Leave seven full days for the historical dataset's publication delay.
  if (+new Date(`${year + 1}-01-01`) > +now - 7 * 86400000)
    throw new DomainError('WEATHER_YEAR', 'Choose a completed calendar year with at least seven days since year end.');
  const dates: string[] = [];
  for (let day = +new Date(start); day < +new Date(`${year + 1}-01-01`); day += 86400000)
    dates.push(new Date(day).toISOString().slice(0, 10));
  return { start, end, dates };
}
// Each available-month range has its own identity. Later fetches append evidence rather than overwrite it.
export function weatherPeriod(year: number, methodology?: string, now = new Date()) {
  if (methodology === weatherMethod) return { ...weatherDates(year, now), methodology: weatherMethod };
  if (!methodology) {
    try {
      return { ...weatherDates(year, now), methodology: weatherMethod };
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  if (!Number.isInteger(year) || year < 1940 || year > 2199)
    throw new DomainError('WEATHER_YEAR', 'Weather coverage starts in 1940.');
  // ERA5 is published with a five-day delay. Include a month when its last day is eligible.
  const published = new Date(+now - 5 * 86400000);
  const monthEnd = new Date(Date.UTC(published.getUTCFullYear(), published.getUTCMonth() + 1, 0));
  const latest =
    monthEnd.toISOString().slice(0, 10) <= published.toISOString().slice(0, 10)
      ? monthEnd
      : new Date(Date.UTC(published.getUTCFullYear(), published.getUTCMonth(), 0));
  const end =
    methodology?.match(/^daily-mean-degree-days-v1:through:(\d{4}-\d{2}-\d{2})$/)?.[1] ??
    latest.toISOString().slice(0, 10);
  const finalDay = new Date(`${end}T00:00:00Z`);
  if (
    (methodology && methodology !== `${weatherMethod}:through:${end}`) ||
    !Number.isFinite(+finalDay) ||
    finalDay.getUTCFullYear() !== year ||
    +finalDay > +latest ||
    new Date(+finalDay + 86400000).getUTCDate() !== 1
  )
    throw new DomainError('WEATHER_YEAR', 'No complete, published weather months are available for this year.');
  const start = `${year}-01-01`,
    dates: string[] = [];
  for (let day = +new Date(start); day <= +finalDay; day += 86400000)
    dates.push(new Date(day).toISOString().slice(0, 10));
  return { start, end, dates, methodology: `${weatherMethod}:through:${end}` };
}
export type WeatherDay = { date: string; meanTemperature: number; daylightSeconds: number };
export type WeatherMonth = {
  month: string;
  days: number;
  meanTemperature: number;
  heatingDegreeDays: number;
  coolingDegreeDays: number;
  daylightHours: number;
};
export function aggregateWeather(
  days: WeatherDay[],
  settings: Pick<WeatherSettings, 'heatingBase' | 'coolingBase'>,
): WeatherMonth[] {
  const months = new Map<string, WeatherMonth>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const month = months.get(key) ?? {
      month: key,
      days: 0,
      meanTemperature: 0,
      heatingDegreeDays: 0,
      coolingDegreeDays: 0,
      daylightHours: 0,
    };
    month.days++;
    month.meanTemperature += day.meanTemperature;
    month.heatingDegreeDays += Math.max(0, Number(settings.heatingBase) - day.meanTemperature);
    month.coolingDegreeDays += Math.max(0, day.meanTemperature - Number(settings.coolingBase));
    month.daylightHours += day.daylightSeconds / 3600;
    months.set(key, month);
  }
  const round = (n: number) => Number(n.toFixed(3));
  return [...months.values()].map((m) => ({
    ...m,
    meanTemperature: round(m.meanTemperature / m.days),
    heatingDegreeDays: round(m.heatingDegreeDays),
    coolingDegreeDays: round(m.coolingDegreeDays),
    daylightHours: round(m.daylightHours),
  }));
}
