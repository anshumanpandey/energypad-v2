import type { CarbonSnapshot, CarbonSummary, PortfolioCarbonSummary } from './carbon';
export type CarbonReport = {
  fingerprint?: string;
  reportVersion: 'carbon-report-v1';
  organisationId: string;
  subject: { kind: 'site' | 'portfolio'; id: string; name: string };
  scope: 'SITE_ACTIVE_METERS' | PortfolioCarbonSummary['scope'];
  checkedAt: string;
  definition: CarbonSummary['definition'];
  status: CarbonSummary['status'];
  totalKgCO2e: string | null;
  unit: 'kgCO2e';
  note: string;
  sites: PortfolioCarbonSummary['sites'];
  evidence: { id: string; siteId: string; algorithmVersion: string; createdAt: string; snapshot: CarbonSnapshot }[];
};
const columns = [
  'recordType',
  'reportVersion',
  'organisationId',
  'subjectKind',
  'subjectId',
  'subjectName',
  'scope',
  'checkedAt',
  'year',
  'geography',
  'basis',
  'unit',
  'status',
  'kgCO2e',
  'siteId',
  'siteName',
  'meterId',
  'meterName',
  'runId',
  'algorithmVersion',
  'calculatedAt',
  'month',
  'normalizedKwh',
  'readingId',
  'readingRevision',
  'conversionVersion',
  'factorId',
  'factorRevision',
  'factorKgCO2ePerKwh',
  'estimated',
  'source',
  'issue',
  'note',
] as const;
type Row = Partial<Record<(typeof columns)[number], string | number | boolean | null>>;
// Quote every field and neutralise spreadsheet formula prefixes in untrusted labels/source text.
export function csvCell(value: Row[keyof Row]): string {
  let text = value == null ? '' : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function carbonReportCsv(report: CarbonReport): string {
  const common: Row = {
    reportVersion: report.reportVersion,
    organisationId: report.organisationId,
    subjectKind: report.subject.kind,
    subjectId: report.subject.id,
    subjectName: report.subject.name,
    scope: report.scope,
    checkedAt: report.checkedAt,
    year: report.definition.year,
    geography: report.definition.geography,
    basis: report.definition.basis,
    unit: report.unit,
  };
  const rows: Row[] = [
    { ...common, recordType: 'REPORT', status: report.status, kgCO2e: report.totalKgCO2e, note: report.note },
  ];
  const evidence = new Map(report.evidence.map((run) => [run.id, run]));
  for (const site of report.sites) {
    const siteFields = { ...common, siteId: site.id, siteName: site.name };
    rows.push({ ...siteFields, recordType: 'SITE', status: site.summary.status, kgCO2e: site.summary.totalKgCO2e });
    for (const meter of site.summary.meters) {
      const run = meter.runId ? evidence.get(meter.runId) : undefined;
      const meterFields = {
        ...siteFields,
        meterId: meter.meterId,
        meterName: meter.name,
        runId: meter.runId,
        algorithmVersion: run?.algorithmVersion,
        calculatedAt: meter.calculatedAt,
      };
      rows.push({
        ...meterFields,
        recordType: 'METER',
        status: meter.status,
        kgCO2e: meter.kgCO2e,
        issue: meter.issue,
      });
      for (const month of run?.snapshot.rows ?? [])
        rows.push({
          ...meterFields,
          recordType: 'MONTH',
          status: month.issue ? 'BLOCKED' : 'SAVED_RESULT',
          month: month.month,
          normalizedKwh: month.normalizedKwh,
          kgCO2e: month.kgCO2e,
          readingId: month.readingId,
          readingRevision: month.readingRevision,
          conversionVersion: month.conversionVersion,
          factorId: month.factorId,
          factorRevision: month.factorRevision,
          factorKgCO2ePerKwh: month.factor,
          estimated: month.estimated,
          source: month.source,
          issue: month.issue,
          note: 'Historical monthly evidence for the referenced run; METER status determines current coverage.',
        });
    }
  }
  return (
    [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join(
      '\r\n',
    ) + '\r\n'
  );
}
