import {
  historicConsumptionService,
  historicEmissionsService,
  driverClassificationService,
  targetImportService,
} from '@/server/services';
import { inventoryQuery, inventoryExportQuery, inventoryReviewQuery } from '@/domain/import-inventory';
import { importInventoryService } from '@/server/services';
import { reportDeliveryWorker } from '@/server/services';
import { auditExportCsv } from '@/domain/audit-export';
import { reportScheduleService } from '@/server/services';
import { reportArchiveService } from '@/server/services';
import { billingService } from '@/server/services';
import { opportunityBodyLimits } from '@/server/opportunity-body-limits';
import { aiGenerationService } from '@/server/services';
import { aiEvidenceService } from '@/server/services';
import { opportunityService } from '@/server/services';
import { analyticsReportService } from '@/server/services';
import { reportResponse } from '@/server/analytics-reports';
import { monthlyPlanCorrection } from '@/domain/monthly-plans';
import { monthlyPlanService } from '@/server/services';
import { carbonReportCsv } from '@/domain/carbon-report';
import { parseTemplateText } from '@/domain/workbook-template';
import { api, readBody, readBytes } from '@/server/http';
import {
  foundation,
  carbonService,
  carbonImportService,
  carbonTargetService,
  emissionFactorService,
  analysisService,
  occupancyService,
  patternService,
  eventService,
  siteService,
  energyService,
  energyImportService,
  driverService,
  weatherService,
  tariffService,
  energyCatalogService,
} from '@/server/services';
import { DomainError } from '@/domain/policy';
import { calculationWorkbook } from '@/server/analysis/calculation-workbook';
import { calculationFilename, calculationMethodName } from '@/domain/analysis/calculation-download';
import type { RegressionResult } from '@/domain/analysis/regression';
import type { ReportingResult } from '@/domain/analysis/reporting';

type Context = { params: Promise<{ segments: string[] }> };
async function handle(request: Request, context: Context) {
  return api(request, async (actor) => {
    const { segments: s } = await context.params;
    const method = request.method;
    if (s.join('/') === 'organisations') {
      if (method === 'GET') return foundation.listOrganisations(actor);
      if (method === 'POST') return foundation.createOrganisation(actor, await readBody(request));
    }
    if (s.join('/') === 'invitations/accept' && method === 'POST')
      return foundation.acceptInvitation(actor, await readBody(request));
    if (s[0] === 'organisations' && s[1]) {
      const org = s[1];
      if (s[2] === 'consumption-records' && s.length === 3 && method === 'GET')
        return energyService.allRecords(actor, org);
      if (s[2] === 'target-imports' && s.length === 4 && method === 'POST' && ['preview', 'commit'].includes(s[3]))
        return targetImportService.process(
          actor,
          org,
          await readBytes(request, 2_000_000),
          s[3] === 'commit' ? (request.headers.get('X-Import-Signature') ?? '') : undefined,
          request.headers.get('X-Fill-Missing-Months') === 'true',
        );
      if (s[2] === 'driver-classification-imports') {
        if (s.length === 4 && method === 'PATCH')
          return driverClassificationService.update(actor, org, s[3], await readBody(request));
        if (s.length === 3 && method === 'GET') return driverClassificationService.list(actor, org);
        if (s.length === 4 && method === 'POST' && ['preview', 'commit'].includes(s[3]))
          return driverClassificationService.process(
            actor,
            org,
            await readBytes(request, 2_000_000),
            s[3] === 'commit' ? (request.headers.get('X-Import-Signature') ?? '') : undefined,
          );
      }
      if (s[2] === 'emissions-imports' && s.length === 4 && method === 'POST' && ['preview', 'commit'].includes(s[3])) {
        const query = new URL(request.url).searchParams;
        return historicEmissionsService.process(
          actor,
          org,
          await readBytes(request, 2_000_000),
          { geography: query.get('geography'), basis: query.get('basis') },
          s[3] === 'commit' ? (request.headers.get('X-Import-Signature') ?? '') : undefined,
          request.headers.get('X-Fill-Missing-Months') === 'true',
        );
      }
      if (
        s[2] === 'consumption-imports' &&
        s.length === 4 &&
        method === 'POST' &&
        ['preview', 'commit'].includes(s[3])
      ) {
        const signature = s[3] === 'commit' ? (request.headers.get('X-Import-Signature') ?? '') : undefined;
        return historicConsumptionService.process(
          actor,
          org,
          await readBytes(request, 2_000_000),
          signature,
          request.headers.get('X-Fill-Missing-Months') === 'true',
        );
      }
      if (s[2] === 'import-inventory' && s[3] === 'inconsistent' && s.length === 4 && method === 'GET')
        return importInventoryService.inconsistentBatches(
          actor,
          org,
          inventoryReviewQuery(new URL(request.url).searchParams),
        );
      if (s[2] === 'import-inventory' && s[3] === 'export' && s.length === 4 && method === 'GET') {
        const query = inventoryExportQuery(new URL(request.url).searchParams);
        const report = await importInventoryService.exportInventory(actor, org, query.before, query.fingerprint);
        return Response.json(report, {
          headers: {
            'Content-Disposition': 'attachment; filename="import-retention-inventory.json"',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      if (s[2] === 'import-inventory' && s.length === 3 && method === 'GET')
        return importInventoryService.overview(
          actor,
          org,
          inventoryQuery(new URL(request.url).searchParams).toISOString(),
        );
      if (s[2] === 'billing' && s.length === 3 && method === 'GET') return billingService.overview(actor, org);
      if (s[2] === 'sites' && s[3] && s[4] === 'ai-evidence' && s.length === 7 && s[6] === 'source' && method === 'GET')
        return aiEvidenceService.citedOpportunitySource(actor, org, s[3], s[5]);
      if (
        s[2] === 'sites' &&
        s[3] &&
        s[4] === 'opportunities' &&
        s.length === 7 &&
        s[6] === 'report' &&
        method === 'GET'
      )
        return reportResponse(
          await opportunityService.opportunityReport(actor, org, s[3], s[5]),
          'json',
          new URL(request.url).searchParams.get('fingerprint'),
        );
      if (s[2] === 'sites' && s[3] && s[4] === 'ai-answers') {
        if (s.length === 6 && s[5] === 'history' && method === 'GET')
          return aiGenerationService.generationHistoryPage(
            actor,
            org,
            s[3],
            new URL(request.url).searchParams.get('cursor') ?? undefined,
          );
        if (s.length === 7 && s[6] === 'reconcile' && method === 'POST')
          return aiGenerationService.reconcile(actor, org, s[3], s[5]);
        if (s.length === 6 && s[5] === 'availability' && method === 'GET')
          return aiGenerationService.availability(actor, org, s[3]);
        if (s.length === 5 && method === 'GET') return aiGenerationService.generationHistory(actor, org, s[3]);
        if (s.length === 5 && method === 'POST')
          return aiGenerationService.generate(actor, org, s[3], await readBody(request));
      }

      if (s[2] === 'sites' && s[3] && s[4] === 'ai-evidence' && s.length === 5) {
        if (method === 'POST') return aiEvidenceService.previewEvidence(actor, org, s[3], await readBody(request));
        if (method === 'GET')
          return aiEvidenceService.evidenceHistory(actor, org, s[3], {
            cursor: new URL(request.url).searchParams.get('cursor') ?? undefined,
          });
      }

      if (s[2] === 'sites' && s[3] && s[4] === 'opportunities') {
        if (s.length === 6 && s[5] === 'supporting-options' && method === 'GET') {
          const query = new URL(request.url).searchParams;
          const historical = query.get('historical');
          if (historical !== null && !['true', 'false'].includes(historical))
            throw new DomainError('VALIDATION_ERROR', 'Choose a valid history filter.');
          return opportunityService.supportingOptions(actor, org, s[3], {
            cursor: query.get('cursor') ?? undefined,
            query: query.get('query') ?? '',
            historical: historical === 'true',
            id: query.get('id') ?? undefined,
          });
        }
        if (s.length === 7 && s[6] === 'supporting-evidence' && method === 'POST')
          return opportunityService.saveSupportingEvidence(
            actor,
            org,
            s[3],
            s[5],
            await readBody(request, opportunityBodyLimits.supporting),
          );
        if (s.length === 7 && s[6] === 'verification-options' && method === 'GET') {
          const query = new URL(request.url).searchParams;
          return opportunityService.verificationOptions(actor, org, s[3], s[5], {
            implementationDate: query.get('implementationDate'),
            cursor: query.get('cursor') ?? undefined,
            runId: query.get('runId') ?? undefined,
          });
        }
        if (s.length === 7 && s[6] === 'verification' && method === 'POST')
          return opportunityService.submitVerification(
            actor,
            org,
            s[3],
            s[5],
            await readBody(request, opportunityBodyLimits.verification),
          );
        if (s.length === 6 && s[5] === 'owners' && method === 'GET')
          return opportunityService.opportunityOwners(actor, org, s[3]);
        if (s.length === 7 && s[6] === 'work' && method === 'POST')
          return opportunityService.saveOpportunityWork(
            actor,
            org,
            s[3],
            s[5],
            await readBody(request, opportunityBodyLimits.work),
          );
        const query = new URL(request.url).searchParams;
        if (s.length === 5 && method === 'GET')
          return opportunityService.listOpportunities(actor, org, s[3], { cursor: query.get('cursor') ?? undefined });
        if (s.length === 5 && method === 'POST')
          return opportunityService.createOpportunity(
            actor,
            org,
            s[3],
            await readBody(request, opportunityBodyLimits.create),
          );
        if (s.length === 7 && s[6] === 'review' && method === 'POST')
          return opportunityService.reviewOpportunity(
            actor,
            org,
            s[3],
            s[5],
            await readBody(request, opportunityBodyLimits.review),
          );
      }

      if (s[2] === 'sites' && s[3] && s[4] === 'report-schedules') {
        const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined;
        if (s.length === 5 && method === 'GET') return reportScheduleService.list(actor, org, s[3], cursor);
        if (s.length === 5 && method === 'POST') {
          const {
            requestKey: _key,
            requestHash: _hash,
            ...revision
          } = await reportScheduleService.save(actor, org, s[3], await readBody(request));
          void _key;
          void _hash;
          return { delivery: 'DISABLED', revision };
        }
        if (s.length === 6 && method === 'GET') return reportScheduleService.detail(actor, org, s[3], s[5]);
        if (s.length === 7 && s[6] === 'history' && method === 'GET')
          return reportScheduleService.history(actor, org, s[3], s[5], cursor);
        if (s.length === 7 && s[6] === 'jobs' && method === 'GET')
          return reportScheduleService.jobs(actor, org, s[3], s[5], cursor);
        if (s.length === 9 && s[6] === 'jobs' && s[8] === 'checks' && method === 'POST')
          return reportDeliveryWorker.execute(actor, org, s[3], s[5], s[7], await readBody(request));
        if (s.length === 9 && s[6] === 'jobs' && s[8] === 'checks' && method === 'GET')
          return reportScheduleService.checks(actor, org, s[3], s[5], s[7], cursor);
        if (s.length === 7 && s[6] === 'jobs' && method === 'POST')
          return {
            delivery: 'DISABLED',
            job: await reportScheduleService.prepareOccurrence(actor, org, s[3], s[5], await readBody(request)),
          };
      }

      if (s[2] === 'sites' && s[3] && s[4] === 'report-archives') {
        const query = new URL(request.url).searchParams;
        if (s.length === 5 && method === 'POST')
          return reportArchiveService.capture(actor, org, s[3], await readBody(request));
        if (s.length === 5 && method === 'GET')
          return reportArchiveService.history(actor, org, s[3], query.get('cursor') ?? undefined);
        if (s.length === 6 && method === 'GET') {
          const format = query.get('format') ?? 'json';
          if (!['json', 'csv'].includes(format)) throw new DomainError('REPORT_FORMAT', 'Choose CSV or JSON.');
          return reportResponse(await reportArchiveService.read(actor, org, s[3], s[5]), format);
        }
      }

      if (s[2] === 'sites' && s[3] && s[4] === 'reports' && s.length === 5 && method === 'GET') {
        const query = new URL(request.url).searchParams;
        const { format = 'json', fingerprint, ...input } = Object.fromEntries(query);
        if (!['csv', 'json'].includes(format)) throw new DomainError('REPORT_FORMAT', 'Choose CSV or JSON.');
        const report = await analyticsReportService.report(actor, org, s[3], input);
        return reportResponse(report, format, fingerprint);
      }

      if (
        ['sites', 'portfolios'].includes(s[2]) &&
        s[3] &&
        s[4] === 'carbon' &&
        s[5] === 'report' &&
        s.length === 6 &&
        method === 'GET'
      ) {
        const query = new URL(request.url).searchParams;
        const format = query.get('format') ?? 'json';
        if (format !== 'json' && format !== 'csv') throw new DomainError('REPORT_FORMAT', 'Choose CSV or JSON.');
        const report = await carbonService.report(
          actor,
          org,
          s[2] === 'sites' ? 'site' : 'portfolio',
          s[3],
          {
            year: Number(query.get('year')),
            geography: query.get('geography'),
            basis: query.get('basis'),
          },
          query.get('fingerprint'),
        );
        return new Response(format === 'csv' ? carbonReportCsv(report) : JSON.stringify(report, null, 2) + '\n', {
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="carbon-${report.subject.kind}-${report.subject.id}-${report.definition.year}.${format}"`,
            'X-Content-Type-Options': 'nosniff',
            'X-Report-Fingerprint': report.fingerprint!,
          },
        });
      }
      if (s[2] === 'portfolios' && s[3] && s[4] === 'energy' && s.length === 5 && method === 'GET') {
        const query = new URL(request.url).searchParams;
        return carbonService.portfolioEnergy(actor, org, s[3], {
          year: Number(query.get('year')),
          fuel: query.get('fuel') ?? 'ALL',
          ...(query.get('siteId') ? { siteId: query.get('siteId') } : {}),
        });
      }
      if (s[2] === 'portfolios' && s[3] && s[4] === 'carbon' && s.length === 5 && method === 'GET') {
        const query = new URL(request.url).searchParams;
        return carbonService.portfolioSummary(actor, org, s[3], {
          year: Number(query.get('year')),
          geography: query.get('geography'),
          basis: query.get('basis'),
        });
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'monthly-plans') {
        if (s.length === 5 && method === 'GET')
          return monthlyPlanService.list(actor, org, s[3], Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 5 && method === 'POST')
          return monthlyPlanService.add(actor, org, s[3], await readBody(request));
        if (s.length === 7 && s[6] === 'correct' && method === 'POST') {
          const body = monthlyPlanCorrection.parse(await readBody(request));
          return monthlyPlanService.add(actor, org, s[3], body.plan, s[5], body.reason);
        }
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s[5] === 'imports') {
        if (s.length === 6 && method === 'POST') {
          const query = new URL(request.url).searchParams;
          return carbonImportService.upload(
            actor,
            org,
            s[3],
            query.get('kind'),
            await readBytes(request, 2_000_000),
            query.get('sheet') ?? undefined,
            query.has('template') ? parseTemplateText(query.get('template')!) : undefined,
          );
        }
        if (s.length === 8 && s[7] === 'commit' && method === 'POST') {
          const body = (await readBody(request)) as { confirmed?: unknown } | null;
          if (body?.confirmed !== true)
            throw new DomainError('CONFIRMATION', 'Confirm the reviewed import before committing.');
          return carbonImportService.commit(actor, org, s[3], s[6]);
        }
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s[5] === 'targets') {
        if (s.length === 6 && method === 'GET') return carbonTargetService.list(actor, org, s[3]);
        if (s.length === 6 && method === 'POST')
          return carbonTargetService.add(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return carbonTargetService.correct(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 8 && s[7] === 'assess' && method === 'POST')
          return carbonTargetService.assess(actor, org, s[3], s[6], await readBody(request));
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s[5] === 'summary' && s.length === 6 && method === 'GET') {
        const query = new URL(request.url).searchParams;
        return carbonService.summary(actor, org, s[3], {
          year: Number(query.get('year')),
          geography: query.get('geography'),
          basis: query.get('basis'),
        });
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s[5] === 'history' && s.length === 6 && method === 'GET') {
        const query = new URL(request.url).searchParams;
        return carbonService.historyPage(actor, org, s[3], { cursor: query.get('cursor') ?? undefined });
      }
      if (
        s[2] === 'sites' &&
        s[3] &&
        s[4] === 'carbon' &&
        s[5] === 'runs' &&
        s[6] &&
        s.length === 7 &&
        method === 'GET'
      )
        return carbonService.readRun(actor, org, s[3], s[6]);
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s[5] === 'context' && s.length === 6 && method === 'GET')
        return carbonService.historyContext(actor, org, s[3]);
      if (s[2] === 'sites' && s[3] && s[4] === 'carbon' && s.length === 5) {
        if (method === 'GET') return carbonService.history(actor, org, s[3]);
        if (method === 'POST') return carbonService.calculate(actor, org, s[3], await readBody(request));
      }
      if (s[2] === 'emission-factors') {
        if (s.length === 3 && method === 'GET') return emissionFactorService.list(actor, org);
        if (s.length === 3 && method === 'POST') return emissionFactorService.add(actor, org, await readBody(request));
        if (s.length === 5 && s[4] === 'correct' && method === 'POST')
          return emissionFactorService.correct(actor, org, s[3], await readBody(request));
      }
      if (s[2] === 'sites' && s[3] && s[4] === 'analysis') {
        if (s.length === 6 && s[5] === 'waste-preview.xlsx' && method === 'GET') {
          const query = new URL(request.url).searchParams;
          const result = await analysisService.wastePreview(
            actor,
            org,
            s[3],
            query.has('year') ? Number(query.get('year')) : undefined,
            query.has('drivers') ? query.get('drivers')!.split(',').filter(Boolean) : undefined,
          );
          const source = result.sources.find((item) => item.meterId === query.get('meter'));
          if (!source)
            throw new DomainError(
              'CALCULATION_UNAVAILABLE',
              'Complete the calculation inputs before downloading this sheet.',
              409,
            );
          const site = (await analysisService.historySites(actor, org)).find((item) => item.id === s[3]);
          const bytes = await calculationWorkbook(source.source, site?.name ?? 'Site');
          const membership = (await foundation.listOrganisations(actor)).find((item) => item.organisation.id === org);
          const fit = source.source.baseline.fit as RegressionResult;
          const output = source.source.result.output as ReportingResult;
          if (output.status === 'BLOCKED')
            throw new DomainError('CALCULATION_UNAVAILABLE', 'Calculation inputs are incomplete.', 409);
          const filename = calculationFilename(
            membership?.organisation.name ?? 'Organisation',
            site?.name ?? 'Site',
            result.preview.year,
            calculationMethodName(
              fit.status === 'FITTED' ? fit.coefficients.length : 0,
              output.inputSnapshot.policy.nra,
            ),
          );
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Cache-Control': 'private, no-store',
            },
          });
        }
        if (s.length === 8 && s[5] === 'runs' && s[7] === 'calculation.xlsx' && method === 'GET') {
          const run = await analysisService.readRun(actor, org, s[3], s[6]);
          const site = (await analysisService.historySites(actor, org)).find((item) => item.id === s[3]);
          const bytes = await calculationWorkbook(run, site?.name ?? 'Site');
          const membership = (await foundation.listOrganisations(actor)).find((item) => item.organisation.id === org);
          const fit = run.baseline.fit as unknown as RegressionResult;
          const output = run.result?.output as unknown as ReportingResult;
          if (output.status === 'BLOCKED')
            throw new DomainError('CALCULATION_UNAVAILABLE', 'Calculation inputs are incomplete.', 409);
          const filename = calculationFilename(
            membership?.organisation.name ?? 'Organisation',
            site?.name ?? 'Site',
            Number(output.inputSnapshot.period.firstMonth.slice(0, 4)),
            calculationMethodName(
              fit.status === 'FITTED' ? fit.coefficients.length : 0,
              output.inputSnapshot.policy.nra,
            ),
          );
          return new Response(new Uint8Array(bytes), {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          });
        }
        const query = new URL(request.url).searchParams;
        const historyPage = {
          cursor: query.get('cursor') ?? undefined,
          limit: query.has('limit') ? Number(query.get('limit')) : undefined,
        };
        if (s.length === 8 && s[5] === 'baselines' && s[7] === 'runs' && method === 'GET')
          return analysisService.runHistory(actor, org, s[3], s[6], historyPage);
        if (s.length === 6 && s[5] === 'options' && method === 'GET') return analysisService.options(actor, org, s[3]);
        if (s.length === 6 && s[5] === 'waste-runs' && method === 'GET')
          return analysisService.wasteRuns(actor, org, s[3], historyPage);
        if (s.length === 6 && s[5] === 'history' && method === 'GET')
          return analysisService.history(actor, org, s[3], historyPage);
        if (s.length === 6 && s[5] === 'readiness' && method === 'POST')
          return analysisService.inspectReadiness(actor, org, s[3], await readBody(request));
        if (s.length === 6 && s[5] === 'baselines' && method === 'POST')
          return analysisService.createBaseline(actor, org, s[3], await readBody(request));
        if (s.length === 7 && s[5] === 'baselines' && method === 'GET')
          return analysisService.readBaseline(actor, org, s[3], s[6]);
        if (s.length === 8 && s[5] === 'baselines' && s[7] === 'runs' && method === 'POST')
          return analysisService.run(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 8 && s[5] === 'runs' && s[7] === 'reviews' && method === 'POST')
          return analysisService.reviewNra(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 7 && s[5] === 'runs' && method === 'GET')
          return analysisService.readRun(actor, org, s[3], s[6]);
      }

      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'occupancy') {
        if (s.length === 6 && method === 'GET')
          return occupancyService.list(actor, org, s[3], Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 6 && method === 'POST') return occupancyService.add(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return occupancyService.correct(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 8 && s[7] === 'history' && method === 'GET')
          return occupancyService.history(actor, org, s[3], s[6]);
        if (s.length === 7 && s[6] === 'imports' && method === 'GET') return occupancyService.imports(actor, org, s[3]);
        if (s.length === 7 && s[6] === 'imports' && method === 'POST')
          return occupancyService.upload(actor, org, s[3], await readBytes(request, 2_000_000));
        if (s.length === 9 && s[6] === 'imports' && s[8] === 'commit' && method === 'POST')
          return occupancyService.commit(actor, org, s[3], s[7]);
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'patterns') {
        if (s.length === 6 && method === 'GET')
          return patternService.list(actor, org, s[3], Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 6 && method === 'POST') return patternService.add(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return patternService.correct(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 8 && s[7] === 'history' && method === 'GET')
          return patternService.history(actor, org, s[3], s[6]);
        if (s.length === 7 && s[6] === 'imports' && method === 'GET') return patternService.imports(actor, org, s[3]);
        if (s.length === 7 && s[6] === 'imports' && method === 'POST')
          return patternService.upload(
            actor,
            org,
            s[3],
            await readBytes(request, 2_000_000),
            new URL(request.url).searchParams.get('sheet') ?? undefined,
            new URL(request.url).searchParams.has('template')
              ? parseTemplateText(new URL(request.url).searchParams.get('template')!)
              : undefined,
          );
        if (s.length === 9 && s[6] === 'imports' && s[8] === 'commit' && method === 'POST')
          return patternService.commit(actor, org, s[3], s[7]);
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'events') {
        if (s.length === 6 && method === 'GET')
          return eventService.list(actor, org, s[3], Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 6 && method === 'POST') return eventService.add(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return eventService.correct(actor, org, s[3], s[6], await readBody(request));
        if (s.length === 8 && s[7] === 'history' && method === 'GET')
          return eventService.history(actor, org, s[3], s[6]);
        if (s.length === 7 && s[6] === 'imports' && method === 'GET') return eventService.imports(actor, org, s[3]);
        if (s.length === 7 && s[6] === 'imports' && method === 'POST')
          return eventService.upload(actor, org, s[3], await readBytes(request, 2_000_000));
        if (s.length === 9 && s[6] === 'imports' && s[8] === 'commit' && method === 'POST')
          return eventService.commit(actor, org, s[3], s[7]);
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'catalog') {
        if (s.length === 6 && method === 'GET') return energyCatalogService.list(actor, org, s[3]);
        if (s.length === 6 && method === 'POST')
          return energyCatalogService.add(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'history' && method === 'GET')
          return energyCatalogService.history(actor, org, s[3], s[6]);
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return energyCatalogService.correct(actor, org, s[3], s[6], await readBody(request));
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'tariffs') {
        if (s.length === 6 && method === 'GET') return tariffService.list(actor, org, s[3]);
        if (s.length === 6 && method === 'POST') return tariffService.add(actor, org, s[3], await readBody(request));
        if (s.length === 7 && s[6] === 'uses' && method === 'POST')
          return tariffService.addUse(actor, org, s[3], await readBody(request));
        if (s.length === 8 && s[7] === 'history' && method === 'GET')
          return tariffService.history(actor, org, s[3], s[6]);
        if (s.length === 8 && s[7] === 'correct' && method === 'POST')
          return tariffService.correct(actor, org, s[3], s[6], await readBody(request));
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'weather') {
        if (s.length === 7 && s[6] === 'prepare-calculation' && method === 'POST')
          return weatherService.prepareCalculation(actor, org, s[3], await readBody(request));
        if (s.length === 9 && s[6] === 'jobs' && s[8] === 'retry' && method === 'POST')
          return weatherService.retry(actor, org, s[3], s[7]).then((job) => ({ id: job.id, status: job.status }));
        if (s.length === 6 && method === 'GET')
          return weatherService.list(actor, org, s[3], Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 7 && s[6] === 'configuration' && method === 'POST')
          return weatherService.configure(actor, org, s[3], await readBody(request));
        if (s.length === 7 && s[6] === 'enrich' && method === 'POST')
          return weatherService
            .enqueue(actor, org, s[3], await readBody(request))
            .then((job) => ({ id: job.id, status: job.status }));
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'drivers') {
        const site = s[3];
        if (s.length === 9 && (s[6] === 'observations' || s[6] === 'schedules')) {
          if (s[8] === 'history' && method === 'GET') return driverService.history(actor, org, site, s[7], s[6]);
          if (s[8] === 'correct' && method === 'POST')
            return s[6] === 'observations'
              ? driverService.correctObservation(actor, org, site, s[7], await readBody(request))
              : driverService.correctSchedule(actor, org, site, s[7], await readBody(request));
        }

        if (s.length === 6 && method === 'GET')
          return driverService.list(actor, org, site, Number(new URL(request.url).searchParams.get('year')));
        if (s.length === 6 && method === 'POST') return driverService.add(actor, org, site, await readBody(request));
        if (s.length === 7 && s[6] === 'schedules' && method === 'POST')
          return driverService.addSchedule(actor, org, site, await readBody(request));
        if (s.length === 7 && s[6] === 'imports' && method === 'GET') return driverService.imports(actor, org, site);
        if (s.length === 7 && s[6] === 'imports' && method === 'POST')
          return driverService.upload(
            actor,
            org,
            site,
            await readBytes(request, 2_000_000),
            new URL(request.url).searchParams.get('sheet') ?? undefined,
            new URL(request.url).searchParams.has('template')
              ? parseTemplateText(new URL(request.url).searchParams.get('template')!)
              : undefined,
          );
        if (s.length === 9 && s[6] === 'imports' && s[8] === 'commit' && method === 'POST')
          return driverService.commit(actor, org, site, s[7]);
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s[5] === 'imports') {
        const site = s[3];
        if (s.length === 6 && method === 'GET') return energyImportService.list(actor, org, site);
        if (s.length === 6 && method === 'POST')
          return energyImportService.upload(
            actor,
            org,
            site,
            new URL(request.url).searchParams.get('meterId') ?? '',
            await readBytes(request, 2_000_000),
          );
        if (s.length === 7 && method === 'GET') return energyImportService.detail(actor, org, site, s[6]);
        if (s.length === 8 && s[7] === 'preview' && method === 'POST')
          return energyImportService.map(actor, org, site, s[6], await readBody(request));
        if (s.length === 8 && s[7] === 'commit' && method === 'POST')
          return energyImportService.commit(actor, org, site, s[6]);
      }
      if (s[2] === 'portfolios') {
        if (s.length === 3 && method === 'GET') return siteService.portfolios(actor, org);
        if (s.length === 3 && method === 'POST') return siteService.savePortfolio(actor, org, await readBody(request));
        if (s.length === 4 && method === 'PATCH')
          return siteService.savePortfolio(actor, org, await readBody(request), s[3]);
        if (s.length === 4 && method === 'DELETE') return siteService.archivePortfolio(actor, org, s[3]);
      }
      if (s[2] === 'imports') {
        if (s.length === 3 && method === 'GET') return siteService.imports(actor, org);
        if (s.length === 3 && method === 'POST')
          return siteService.upload(actor, org, await readBytes(request, 2_000_000));
        if (s.length === 4 && method === 'GET') return siteService.importDetail(actor, org, s[3]);
        if (s.length === 5 && s[4] === 'preview' && method === 'POST')
          return siteService.mapImport(actor, org, s[3], await readBody(request));
        if (s.length === 5 && s[4] === 'commit' && method === 'POST') return siteService.commitImport(actor, org, s[3]);
      }
      if (s[2] === 'sites' && s[4] === 'energy' && s.length === 8) {
        if (s[5] === 'records' && s[7] === 'history' && method === 'GET')
          return energyService.readingHistory(actor, org, s[3], s[6]);
        if (s[5] === 'records' && s[7] === 'correct' && method === 'POST')
          return energyService.correctReading(actor, org, s[3], s[6], await readBody(request));
        if (s[5] === 'conversions' && s[7] === 'history' && method === 'GET')
          return energyService.conversionHistory(actor, org, s[3], s[6]);
        if (s[5] === 'conversions' && s[7] === 'correct' && method === 'POST')
          return energyService.correctConversion(actor, org, s[3], s[6], await readBody(request));
      }
      if (s[2] === 'sites' && s.length === 6 && s[4] === 'energy' && s[5] === 'conversions' && method === 'POST')
        return energyService.addConversion(actor, org, s[3], await readBody(request));
      if (s[2] === 'sites' && s.length === 5 && s[4] === 'energy') {
        if (method === 'GET')
          return energyService.records(
            actor,
            org,
            s[3],
            Number(new URL(request.url).searchParams.get('year') ?? new Date().getUTCFullYear()),
          );
        if (method === 'POST') return energyService.add(actor, org, s[3], await readBody(request));
      }
      if (s[2] === 'sites') {
        if (s.length === 3 && method === 'POST') return siteService.createSite(actor, org, await readBody(request));
        if (s.length === 4 && method === 'GET') return siteService.siteDetail(actor, org, s[3]);
        if (s.length === 4 && method === 'PATCH')
          return siteService.updateSite(actor, org, s[3], await readBody(request));
        if (s.length === 4 && method === 'DELETE') return siteService.archiveSite(actor, org, s[3]);
        if (s.length === 5 && s[4] === 'attributes' && method === 'POST')
          return siteService.addAttributes(actor, org, s[3], await readBody(request));
        if (s[4] === 'meters') {
          if (s.length === 5 && method === 'POST')
            return siteService.saveMeter(actor, org, s[3], await readBody(request));
          if (s.length === 6 && method === 'PATCH')
            return siteService.saveMeter(actor, org, s[3], await readBody(request), s[5]);
          if (s.length === 6 && method === 'DELETE') return siteService.archiveMeter(actor, org, s[3], s[5]);
        }
      }
      if (s.length === 2) {
        if (method === 'GET') return foundation.getWorkspace(actor, org);
        if (method === 'PATCH') return foundation.updateOrganisation(actor, org, await readBody(request));
      }
      if (s.length === 3) {
        if (s[2] === 'members' && method === 'GET') return foundation.listMembers(actor, org);
        if (s[2] === 'invitations') {
          if (method === 'GET') return foundation.listInvitations(actor, org);
          if (method === 'POST') return foundation.invite(actor, org, await readBody(request));
        }
        if (s[2] === 'sites' && method === 'GET') return foundation.listSites(actor, org);
        if (s[2] === 'audit' && method === 'GET') return foundation.listAudit(actor, org);
      }
      if (s.length === 4) {
        if (s[2] === 'audit' && ['history', 'export'].includes(s[3]) && method === 'GET') {
          const query = new URL(request.url).searchParams;
          const value = (key: string) =>
            query.getAll(key).length > 1 ? query.getAll(key) : (query.get(key) ?? undefined);
          if (query.getAll('cursor').length > 1) throw new DomainError('VALIDATION', 'Use one activity cursor.', 400);
          const filters = {
            action: value('action'),
            requestId: value('requestId'),
          };
          if (s[3] === 'history') return foundation.auditHistory(actor, org, query.get('cursor') ?? undefined, filters);
          const format = query.get('format') ?? 'json';
          if (query.getAll('format').length > 1 || !['json', 'csv'].includes(format))
            throw new DomainError('EXPORT_FORMAT', 'Choose CSV or JSON.');
          const report = await foundation.exportAudit(actor, org, query.get('cursor') ?? undefined, filters);
          return new Response(format === 'csv' ? auditExportCsv(report) : JSON.stringify(report, null, 2) + '\n', {
            headers: {
              'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
              'Content-Disposition': `attachment; filename="activity-page.${format}"`,
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
        if (s[2] === 'members') {
          if (method === 'PATCH') return foundation.changeMember(actor, org, s[3], await readBody(request));
          if (method === 'DELETE') return foundation.changeMember(actor, org, s[3], undefined, true);
        }
        if (s[2] === 'invitations' && method === 'DELETE') return foundation.revokeInvitation(actor, org, s[3]);
        if (s[2] === 'sites' && method === 'GET') return foundation.getSite(actor, org, s[3]);
      }
      if (s.length === 5 && s[2] === 'members' && s[4] === 'sites' && method === 'PUT')
        return foundation.assignSites(actor, org, s[3], await readBody(request));
    }
    throw new DomainError('NOT_FOUND', 'This endpoint is not available.', 404);
  });
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
