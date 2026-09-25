import { type Actor } from './foundation';
import { AnalysisService } from './analysis/service';
import { DomainError, uuid } from '../domain/policy';
import { overviewEnergy } from '../domain/overview';
import { reportInput, analyticsReportCsv, type AnalyticsReport } from '../domain/analytics-report';
import { snapshotHash, type BaselineDefinition, type RunDefinition } from './analysis/contract';
import type { RegressionResult } from '../domain/analysis/regression';

export function reportFingerprint(report: AnalyticsReport) {
  return snapshotHash(report);
}
export function reportResponse(report: AnalyticsReport, format: string, expected?: string | null) {
  if (!['csv', 'json'].includes(format)) throw new DomainError('REPORT_FORMAT', 'Choose CSV or JSON.');
  if (expected && expected !== reportFingerprint(report))
    throw new DomainError('REPORT_CHANGED', 'Report inputs changed. Preview the report again before downloading.', 409);
  return new Response(format === 'csv' ? analyticsReportCsv(report) : JSON.stringify(report, null, 2) + '\n', {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.family}-${report.siteId}.${format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Report-Fingerprint': reportFingerprint(report),
    },
  });
}
export class AnalyticsReportService extends AnalysisService {
  async report(actor: Actor, org: string, siteId: string, input: unknown): Promise<AnalyticsReport> {
    uuid.parse(siteId);
    const definition = reportInput.parse(input);
    const common = {
      reportVersion: 'analytics-report-v1' as const,
      family: definition.family,
      organisationId: org,
      siteId,
    };
    if (definition.family === 'baseline') {
      const baseline = await this.readBaseline(actor, org, siteId, definition.baselineId);
      const snapshot = baseline.snapshot as unknown as { definition: BaselineDefinition };
      const fit = baseline.fit as unknown as RegressionResult;
      return JSON.parse(
        JSON.stringify({
          ...common,
          period: snapshot.definition.period,
          status: baseline.compatibility,
          note: 'Historical saved baseline. Experimental, not approved savings evidence. Corrections do not refit this model.',
          units: { actualKwh: 'kWh', fittedKwh: 'kWh', residualKwh: 'kWh', residualStandardError: 'kWh' },
          summary: {
            baselineId: baseline.id,
            revision: baseline.revision,
            algorithm: fit.algorithm,
            inputHash: baseline.inputHash,
            sampleSize: fit.status === 'FITTED' ? fit.sampleSize : null,
            rSquared: fit.status === 'FITTED' ? fit.rSquared : null,
            residualStandardError: fit.status === 'FITTED' ? fit.residualStandardError : null,
          },
          rows:
            fit.status === 'FITTED'
              ? fit.rows.map((r) => ({
                  observationId: r.id,
                  actualKwh: r.actual,
                  fittedKwh: r.fitted,
                  residualKwh: r.residual,
                }))
              : [],
          evidence: baseline,
        }),
      );
    }
    if (definition.family === 'savings') {
      const saved = await this.wasteSummary(actor, org, siteId, definition.runId, definition.carbonRunId);
      const snapshot = saved.evidence.runSnapshot as unknown as { request: RunDefinition };
      return JSON.parse(
        JSON.stringify({
          ...common,
          period: snapshot.request.period,
          status: saved.compatibility,
          note: 'Experimental, not verified savings. Positive variance is saving; negative is waste. Financial estimates use original recorded average net cost per kWh. Carbon uses only the selected saved run with matching reading revisions. Missing evidence is unavailable. Monthly significance is not total significance.',
          units: {
            actualKwh: 'kWh',
            expectedKwh: 'kWh',
            adjustedExpectedKwh: 'kWh',
            preKwh: 'kWh',
            postKwh: 'kWh',
            preCost: saved.impact.currency ?? 'Unavailable',
            postCost: saved.impact.currency ?? 'Unavailable',
            preCarbon: 'kgCO2e',
            postCarbon: 'kgCO2e',
          },
          summary: {
            runId: saved.runId,
            baselineId: saved.baselineId,
            algorithm: saved.output.algorithm,
            resultStatus: saved.output.status,
            preKwh: saved.impact.preKwh,
            postKwh: saved.impact.postKwh,
            preCost: saved.impact.preCost,
            postCost: saved.impact.postCost,
            currency: saved.impact.currency,
            preCarbon: saved.impact.preCarbon,
            postCarbon: saved.impact.postCarbon,
            significantMonths: saved.impact.significantMonths,
          },
          rows: saved.impact.rows.map((r) =>
            r.status === 'BLOCKED'
              ? { month: r.month, status: r.status, issue: r.issues.map((i) => i.message).join('; ') }
              : {
                  month: r.month,
                  status: r.status,
                  actualKwh: r.actualKwh,
                  expectedKwh: r.expectedKwh,
                  adjustedExpectedKwh: r.adjustedExpectedKwh,
                  preKwh: r.preNraVarianceKwh,
                  postKwh: r.postNraVarianceKwh,
                  preCost: r.preCost,
                  postCost: r.postCost,
                  currency: r.currency,
                  preCarbon: r.preCarbon,
                  postCarbon: r.postCarbon,
                  significant: r.significance.significant,
                  significanceBasis: r.significance.basis,
                },
          ),
          evidence: saved,
        }),
      );
    }
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, org, undefined, tx);
        const site = await tx.site.findFirst({
          where: {
            id: siteId,
            organisationId: org,
            ...(member.role === 'SITE_MANAGER'
              ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
              : {}),
          },
        });
        if (!site) throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
        const meters = await tx.meter.findMany({
          where: { organisationId: org, siteId, archivedAt: null },
          orderBy: { id: 'asc' },
        });
        const readings = await tx.consumptionRecord.findMany({
          where: {
            organisationId: org,
            siteId,
            meterId: { in: meters.map((m) => m.id) },
            replacement: { is: null },
            periodStart: { lt: new Date(`${definition.year + 1}-01-01`) },
            periodEnd: { gt: new Date(`${definition.year}-01-01`) },
          },
          orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
        });
        const energy = overviewEnergy(
          definition.year,
          meters.map((m) => m.id),
          readings,
        );
        return JSON.parse(
          JSON.stringify({
            ...common,
            period: { firstMonth: `${definition.year}-01`, lastMonth: `${definition.year}-12` },
            status: energy.completeMonths === 12 ? 'COMPLETE' : 'INCOMPLETE',
            note: 'Current active meter scope, using current saved reading revisions. One exact full-month reading per meter is required. Gaps are unavailable, not zero. Net cost requires one currency; no VAT or currency conversion. Main/submeter overlap is not deducted. Corrections may change a new report; exported evidence retains the original inputs.',
            units: { kwh: 'kWh', netCost: energy.currency ?? 'Unavailable' },
            summary: {
              kwh: energy.kwh,
              netCost: energy.netCost,
              currency: energy.currency,
              completeMonths: energy.completeMonths,
              expectedMonths: 12,
              meterCount: meters.length,
            },
            rows: energy.months.map((row) => ({
              month: row.month,
              complete: row.complete,
              kwh: row.kwh,
              netCost: row.netCost,
              currency: row.currency,
              estimated: row.estimated,
            })),
            evidence: {
              algorithm: 'energy-monthly-coverage-v1',
              site: { id: site.id, name: site.name, archived: !!site.archivedAt },
              meters,
              readings,
              monthlyCoverage: energy.months,
            },
          }),
        );
      },
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }
}
