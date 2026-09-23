import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { monthPeriod } from '../../domain/energy';
import { driverDefinitions, periodMonths, dateRange, type BaselineDefinition, type ReadinessIssue } from './contract';
const weatherMonth = z.object({
  month: z.string(),
  days: z.number().int(),
  heatingDegreeDays: z.number().finite().nonnegative(),
  coolingDegreeDays: z.number().finite().nonnegative(),
  daylightHours: z.number().finite().nonnegative(),
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function assemble(
  tx: Prisma.TransactionClient,
  org: string,
  siteId: string,
  definition: BaselineDefinition,
) {
  const scope = { organisationId: org, siteId, meterId: definition.meterId, energyUseId: definition.energyUseId };
  const siteScope = { organisationId: org, siteId };
  const issues: ReadinessIssue[] = [],
    warnings: ReadinessIssue[] = [];
  const fail = (month: string | null, code: string, message: string) => issues.push({ month, code, message });
  const range = dateRange(definition.period),
    wanted = periodMonths(definition.period);
  // Fetch overlaps, not only start dates, so malformed partial/cross-month readings cannot be silently ignored.
  const records = await tx.consumptionRecord.findMany({
    where: { ...scope, replacement: { is: null }, periodStart: { lt: range.lt }, periodEnd: { gt: range.gte } },
    orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
  });
  const observations = await tx.driverObservation.findMany({
    where: { organisationId: org, siteId, replacement: { is: null }, month: range },
    orderBy: [{ month: 'asc' }, { driver: 'asc' }, { id: 'asc' }],
  });
  const weather = definition.weather
    ? await tx.weatherYear.findMany({
        where: {
          organisationId: org,
          siteId,
          ...definition.weather,
          year: {
            gte: Number(definition.period.firstMonth.slice(0, 4)),
            lte: Number(definition.period.lastMonth.slice(0, 4)),
          },
        },
        orderBy: [{ year: 'asc' }, { id: 'asc' }],
      })
    : [];
  const configuration = definition.weather
    ? await tx.weatherConfiguration.findFirst({
        where: { id: definition.weather.configurationId, organisationId: org, siteId },
      })
    : null;
  if (definition.weather && !configuration)
    fail(null, 'WEATHER_SCOPE', 'Weather configuration is not available for this site.');
  for (const record of records) {
    const month = record.periodStart.toISOString().slice(0, 7),
      expected = monthPeriod(month);
    if (+record.periodStart !== +expected.start || +record.periodEnd !== +expected.end)
      fail(month, 'CONSUMPTION_PERIOD', 'Consumption must cover exactly one calendar month.');
  }
  const observation = (month: string, code: 'POPULATION' | 'OPERATING_HOURS') => {
    const matches = observations.filter((o) => o.month.toISOString().slice(0, 7) === month && o.driver === code);
    if (matches.length > 1) fail(month, 'DUPLICATE_DRIVER', `Multiple current ${code} observations.`);
    const o = matches.length === 1 ? matches[0] : null;
    if (o && +o.month !== +monthPeriod(month).start)
      fail(month, 'DRIVER_PERIOD', 'Driver must identify a calendar month.');
    return o
      ? { id: o.id, scope: siteScope, month, kind: code, unit: driverDefinitions[code].unit, value: Number(o.value) }
      : null;
  };
  const adjustmentObservations = wanted.flatMap((month) =>
    (['POPULATION', 'OPERATING_HOURS'] as const).flatMap((code) => {
      const o = observation(month, code);
      return o ? [o] : [];
    }),
  );
  const rows = wanted.map((month) => {
    const matches = records.filter((r) => r.periodStart.toISOString().slice(0, 7) === month);
    if (matches.length !== 1)
      fail(
        month,
        matches.length ? 'DUPLICATE_CONSUMPTION' : 'MISSING_CONSUMPTION',
        'Supply exactly one current consumption record for this meter/end use and month.',
      );
    const record = matches.length === 1 ? matches[0] : null;
    if (record?.estimated)
      (definition.estimatedConsumption === 'BLOCK' ? issues : warnings).push({
        month,
        code: 'ESTIMATED_CONSUMPTION',
        message: 'Consumption is estimated.',
      });
    const drivers = definition.drivers.map((code) => {
      const definition = driverDefinitions[code];
      if (code === 'POPULATION' || code === 'OPERATING_HOURS') {
        const o = adjustmentObservations.find((o) => o.month === month && o.kind === code);
        if (!o) fail(month, 'MISSING_DRIVER', `Missing ${code}.`);
        return {
          id: o?.id ?? `missing:${month}:${code}`,
          scope: siteScope,
          month,
          code,
          unit: definition.unit,
          value: o?.value ?? null,
        };
      }
      const years = weather.filter((w) => w.year === Number(month.slice(0, 4)));
      const parsed = years.length === 1 ? z.array(weatherMonth).safeParse(years[0].monthly) : null;
      const matches = parsed?.success ? parsed.data.filter((m) => m.month === month) : [];
      const expected = monthPeriod(month),
        days = (+expected.end - +expected.start) / 86400000;
      const valid = matches.length === 1 && matches[0].days === days;
      if (!valid) fail(month, 'MISSING_WEATHER', `Missing, duplicate or incomplete ${code} weather month.`);
      return {
        id: valid ? `${years[0].id}:${month}:${code}` : `missing:${month}:${code}`,
        scope: siteScope,
        month,
        code,
        unit: definition.unit,
        value: valid ? matches[0][driverDefinitions[code].field] : null,
      };
    });
    return {
      consumption: {
        id: record?.id ?? `missing:${month}`,
        scope,
        month,
        kwh: record ? Number(record.normalizedKwh) : null,
      },
      drivers,
    };
  });
  return {
    scope,
    rows,
    adjustmentObservations,
    issues,
    warnings,
    // Decimal strings and exact source metadata are preserved alongside engine numeric inputs.
    evidence: json({
      consumption: records,
      observations,
      weather: weather.map((row) => ({
        id: row.id,
        organisationId: row.organisationId,
        siteId: row.siteId,
        configurationId: row.configurationId,
        year: row.year,
        methodology: row.methodology,
        provenance: row.provenance,
        inputHash: row.inputHash,
        monthly: row.monthly,
      })),
      configuration,
    }),
  };
}
