import { z } from 'zod';
import { csvCell } from './carbon-report';
export const reportInput = z.discriminatedUnion('family', [
  z.object({ family: z.literal('energy'), year: z.coerce.number().int().min(1900).max(2199) }).strict(),
  z.object({ family: z.literal('baseline'), baselineId: z.uuid() }).strict(),
  z.object({ family: z.literal('savings'), runId: z.uuid(), carbonRunId: z.uuid().optional() }).strict(),
]);
export type ReportInput = z.infer<typeof reportInput>;
export type ReportValue = string | number | boolean | null;
export type AnalyticsReport = {
  reportVersion: 'analytics-report-v1';
  family: ReportInput['family'];
  organisationId: string;
  siteId: string;
  period: { firstMonth: string; lastMonth: string };
  status: string;
  note: string;
  units: Record<string, string>;
  summary: Record<string, ReportValue>;
  rows: Record<string, ReportValue>[];
  evidence: unknown;
};
// Long-form CSV keeps every nested evidence field, including nulls and empty collections.
// JSON Pointer paths distinguish labels containing slashes, dots or array-like text.
export function reportFields(value: unknown, path = ''): { path: string; value: ReportValue; type: string }[] {
  if (value === null) return [{ path, value: null, type: 'null' }];
  if (typeof value !== 'object') return [{ path, value: value as ReportValue, type: typeof value }];
  const entries = Object.entries(value);
  if (!entries.length) return [{ path, value: Array.isArray(value) ? '[]' : '{}', type: 'empty' }];
  return entries.flatMap(([key, item]) =>
    reportFields(item, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`),
  );
}
export function analyticsReportCsv(report: AnalyticsReport): string {
  return (
    [
      '"path","type","value"',
      ...reportFields(report).map((r) => [r.path, r.type, r.value].map(csvCell).join(',')),
    ].join('\r\n') + '\r\n'
  );
}
