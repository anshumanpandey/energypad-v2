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
      if (s[2] === 'sites' && s[3] && s[4] === 'opportunities') {
        const query = new URL(request.url).searchParams;
        if (s.length === 5 && method === 'GET')
          return opportunityService.listOpportunities(actor, org, s[3], { cursor: query.get('cursor') ?? undefined });
        if (s.length === 5 && method === 'POST')
          return opportunityService.createOpportunity(actor, org, s[3], await readBody(request));
        if (s.length === 7 && s[6] === 'review' && method === 'POST')
          return opportunityService.reviewOpportunity(actor, org, s[3], s[5], await readBody(request));
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
        const report = await carbonService.report(actor, org, s[2] === 'sites' ? 'site' : 'portfolio', s[3], {
          year: Number(query.get('year')),
          geography: query.get('geography'),
          basis: query.get('basis'),
        });
        return new Response(format === 'csv' ? carbonReportCsv(report) : JSON.stringify(report, null, 2) + '\n', {
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="carbon-${report.subject.kind}-${report.subject.id}-${report.definition.year}.${format}"`,
            'X-Content-Type-Options': 'nosniff',
          },
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
