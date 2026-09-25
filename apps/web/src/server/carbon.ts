import {
  carbonTrendInput,
  carbonTrendPoints,
  aggregateTrend,
  trendTotal,
  trendChange,
  type TrendRun,
} from '../domain/carbon-trends';
import type { MonthlyPlanPayload } from '../domain/monthly-plans';
import { benchmarkInput, benchmarkEnergy, rankSites } from '../domain/benchmarking';
import { overviewEnergy } from '../domain/overview';
import type { CarbonReport } from '../domain/carbon-report';
import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import {
  carbonInput,
  carbonSummaryInput,
  type CarbonSummary,
  type CarbonSnapshot,
  type PortfolioCarbonSummary,
} from '../domain/carbon';
import { monthPeriod } from '../domain/energy';
const Decimal = Prisma.Decimal.clone({ precision: 50 });
export const carbonAlgorithmVersion = 'monthly-exact-factor-v1';
export class CarbonService extends FoundationService {
  private async access(tx: Prisma.TransactionClient, actor: Actor, org: string, siteId: string, write: boolean) {
    uuid.parse(siteId);
    const member = await this.membership(actor, org, write ? 'analysis:write' : undefined, tx);
    const site = await tx.site.findFirst({
      where: {
        id: siteId,
        organisationId: org,
        ...(write ? { archivedAt: null } : {}),
        ...(member.role === 'SITE_MANAGER'
          ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
          : {}),
      },
    });
    if (!site) throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
  }
  async history(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId, false);
        return tx.carbonRun.findMany({
          where: { organisationId: org, siteId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        });
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async summary(actor: Actor, org: string, siteId: string, input: unknown): Promise<CarbonSummary> {
    const definition = carbonSummaryInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId, false);
        return this.summaryWithin(tx, org, siteId, definition);
      },
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }
  async overview(actor: Actor, org: string, siteId: string, input: unknown) {
    const definition = carbonSummaryInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        await this.access(tx, actor, org, siteId, false);
        const carbon = await this.summaryWithin(tx, org, siteId, definition);
        const records = await tx.consumptionRecord.findMany({
          where: {
            organisationId: org,
            siteId,
            replacement: { is: null },
            meterId: { in: carbon.meters.map((m) => m.meterId) },
            periodStart: { lt: new Date(`${definition.year + 1}-01-01`) },
            periodEnd: { gt: new Date(`${definition.year}-01-01`) },
          },
          orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
        });
        return {
          carbon,
          energy: overviewEnergy(
            definition.year,
            carbon.meters.map((m) => m.meterId),
            records,
          ),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }
  async benchmark(actor: Actor, org: string, input: unknown) {
    const definition = benchmarkInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, org, undefined, tx);
        const available = await tx.site.findMany({
          where: {
            organisationId: org,
            archivedAt: null,
            ...(member.role === 'SITE_MANAGER'
              ? { assignments: { some: { membershipId: member.id, organisationId: org } } }
              : {}),
          },
          select: { id: true, code: true, name: true, type: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        if (definition.siteId && !available.some((s) => s.id === definition.siteId))
          throw new DomainError('NOT_FOUND', 'This site is not available.', 404);
        const sites = available.filter(
          (s) =>
            (!definition.siteId || s.id === definition.siteId) &&
            (!definition.siteType || s.type === definition.siteType),
        );
        const meters = await tx.meter.findMany({
          where: {
            organisationId: org,
            siteId: { in: sites.map((s) => s.id) },
            archivedAt: null,
            fuel: definition.fuel,
          },
        });
        const readings = await tx.consumptionRecord.findMany({
          where: {
            organisationId: org,
            meterId: { in: meters.map((m) => m.id) },
            replacement: { is: null },
            periodStart: { lt: new Date(`${definition.year + 1}-01-01`) },
            periodEnd: { gt: new Date(`${definition.year}-01-01`) },
          },
          orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
        });
        const targets =
          definition.month === 0
            ? await tx.carbonTargetVersion.findMany({
                where: {
                  organisationId: org,
                  meterId: { in: meters.map((m) => m.id) },
                  year: definition.year,
                  geography: definition.geography,
                  basis: definition.basis,
                  replacement: { is: null },
                },
              })
            : [];
        const monthlyTargets = await tx.monthlyPlanVersion.findMany({
          where: {
            organisationId: org,
            siteId: { in: sites.map((s) => s.id) },
            kind: 'TARGET',
            fuel: definition.fuel,
            month: { startsWith: `${definition.year}-` },
            replacement: { is: null },
          },
        });
        const rows = [];
        for (const site of sites) {
          const selected = meters.filter((m) => m.siteId === site.id);
          const ids = selected.map((m) => m.id);
          const energy = benchmarkEnergy(definition.year, definition.month, definition.currency, ids, readings);
          const energyTargets = monthlyTargets.filter(
            (t) => t.siteId === site.id && energy.months.some((m) => m.month === t.month),
          );
          const energyTargetComplete = energy.months.every(
            (m) => energyTargets.filter((t) => t.month === m.month).length === 1,
          );
          const energyTarget = energyTargetComplete
            ? energyTargets
                .reduce(
                  (sum, t) => sum.plus((t.payload as unknown as MonthlyPlanPayload).normalizedKwh),
                  new Decimal(0),
                )
                .toString()
            : null;
          const summary =
            definition.month === 0 && ids.length ? await this.summaryWithin(tx, org, site.id, definition) : null;
          const carbonMeters = summary?.meters.filter((m) => ids.includes(m.meterId)) ?? [];
          const siteTargets = targets.filter((t) => ids.includes(t.meterId));
          const targetComplete =
            ids.length > 0 && ids.every((id) => siteTargets.filter((t) => t.meterId === id).length === 1);
          const target = targetComplete
            ? siteTargets.reduce((a, t) => a.plus(t.limitKgCO2e.toString()), new Decimal(0)).toString()
            : null;
          const actual =
            carbonMeters.length > 0 && carbonMeters.every((m) => m.status === 'READY')
              ? carbonMeters.reduce((a, m) => a.plus(m.kgCO2e!), new Decimal(0)).toString()
              : null;
          rows.push({
            ...site,
            ...energy,
            energyTarget,
            energyTargetGap:
              energyTarget !== null && energy.kwh !== null
                ? new Decimal(energy.kwh).minus(energyTarget).toString()
                : null,
            energyTargetIssue: energyTargetComplete
              ? null
              : 'Missing or multiple source-unit targets for the selected months; comparison unavailable.',
            energyTargets: energyTargets.map((t) => ({
              id: t.id,
              revision: t.revision,
              month: t.month,
              payload: t.payload as unknown as MonthlyPlanPayload,
            })),
            meterCount: ids.length,
            meters: selected.map((m) => ({ id: m.id, name: m.name })),
            target,
            actualCarbon: actual,
            carbonGap: target !== null && actual !== null ? new Decimal(actual).minus(target).toString() : null,
            targetStatus: definition.month
              ? 'Annual target; no monthly allocation'
              : !targetComplete
                ? 'Missing annual target coverage'
                : actual === null
                  ? 'Carbon calculations missing, blocked or outdated'
                  : new Decimal(actual).lte(target!)
                    ? 'MET'
                    : 'EXCEEDED',
            targets: siteTargets.map((t) => ({
              id: t.id,
              meterId: t.meterId,
              revision: t.revision,
              limit: t.limitKgCO2e.toString(),
              source: t.source,
            })),
            carbonMeters,
          });
        }
        return {
          definition,
          checkedAt: new Date().toISOString(),
          scope: member.role === 'SITE_MANAGER' ? 'Assigned active sites' : 'Active organisation sites',
          available,
          rows: rankSites(rows, definition.metric, definition.order),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
  // Call only after authorizing the site within this transaction.
  private async summaryWithin(
    tx: Prisma.TransactionClient,
    org: string,
    siteId: string,
    definition: CarbonSummary['definition'],
  ): Promise<CarbonSummary> {
    const meters = await tx.meter.findMany({
      where: { organisationId: org, siteId, archivedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const start = new Date(`${definition.year}-01-01`),
      end = new Date(`${definition.year + 1}-01-01`);
    const readings = await tx.consumptionRecord.findMany({
      where: {
        organisationId: org,
        siteId,
        replacement: { is: null },
        periodStart: { lt: end },
        periodEnd: { gt: start },
      },
      select: { id: true, meterId: true },
    });
    const factors = await tx.emissionFactorVersion.findMany({
      where: {
        organisationId: org,
        geography: definition.geography,
        basis: definition.basis,
        unit: 'kgCO2e/kWh',
        replacement: { is: null },
        validFrom: { lt: end },
        validUntil: { gt: start },
      },
      select: { id: true },
    });
    const factorIds = new Set(factors.map((f) => f.id));
    const rows: CarbonSummary['meters'] = [];
    let total = new Decimal(0);
    for (const meter of meters) {
      const run = await tx.carbonRun.findFirst({
        where: {
          organisationId: org,
          siteId,
          AND: [
            { snapshot: { path: ['definition', 'meterId'], equals: meter.id } },
            { snapshot: { path: ['definition', 'year'], equals: definition.year } },
            { snapshot: { path: ['definition', 'geography'], equals: definition.geography } },
            { snapshot: { path: ['definition', 'basis'], equals: definition.basis } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const base = {
        meterId: meter.id,
        name: meter.name,
        fuel: meter.fuel,
        runId: run?.id ?? null,
        calculatedAt: run?.createdAt.toISOString() ?? null,
        kgCO2e: null,
        estimatedMonths: 0,
      };
      if (!run) {
        rows.push({
          ...base,
          status: 'MISSING',
          issue: 'Calculate this meter for the selected year, geography and basis.',
        });
        continue;
      }
      const snapshot = run.snapshot as unknown as CarbonSnapshot;
      if (snapshot.status !== 'COMPLETE' || snapshot.totalKgCO2e === null) {
        rows.push({
          ...base,
          status: 'BLOCKED',
          issue: 'Latest run has incomplete coverage. Resolve its monthly gaps and calculate again.',
        });
        continue;
      }
      const currentReadings = new Set(readings.filter((r) => r.meterId === meter.id).map((r) => r.id));
      const outdated =
        run.algorithmVersion !== carbonAlgorithmVersion ||
        snapshot.rows.length !== 12 ||
        currentReadings.size !== 12 ||
        snapshot.rows.some(
          (r) => !r.readingId || !currentReadings.has(r.readingId) || !r.factorId || !factorIds.has(r.factorId),
        );
      if (outdated) {
        rows.push({
          ...base,
          status: 'OUTDATED',
          issue:
            'Consumption, factors or calculation method changed. Calculate again; the saved run remains unchanged.',
        });
        continue;
      }
      total = total.add(snapshot.totalKgCO2e);
      rows.push({
        ...base,
        status: 'READY',
        kgCO2e: snapshot.totalKgCO2e,
        estimatedMonths: snapshot.rows.filter((r) => r.estimated).length,
        issue: null,
      });
    }
    const ready = rows.length > 0 && rows.every((r) => r.status === 'READY');
    return {
      definition,
      checkedAt: new Date().toISOString(),
      status: !rows.length ? 'EMPTY' : ready ? 'COMPLETE' : 'INCOMPLETE',
      totalKgCO2e: ready ? total.toFixed() : null,
      meters: rows,
    };
  }
  async portfolioSummary(
    actor: Actor,
    org: string,
    portfolioId: string,
    input: unknown,
  ): Promise<PortfolioCarbonSummary> {
    uuid.parse(portfolioId);
    const definition = carbonSummaryInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, org, undefined, tx);
        const assignedOnly = member.role === 'SITE_MANAGER';
        const portfolio = await tx.portfolio.findFirst({
          where: { id: portfolioId, organisationId: org, archivedAt: null },
          select: { id: true, name: true },
        });
        if (!portfolio) throw new DomainError('NOT_FOUND', 'This portfolio is unavailable.', 404);
        const sites = await tx.site.findMany({
          where: {
            organisationId: org,
            portfolioId,
            archivedAt: null,
            ...(assignedOnly ? { assignments: { some: { membershipId: member.id, organisationId: org } } } : {}),
          },
          select: { id: true, name: true, code: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        if (assignedOnly && !sites.length) throw new DomainError('NOT_FOUND', 'This portfolio is unavailable.', 404);
        const rows: PortfolioCarbonSummary['sites'] = [];
        let total = new Decimal(0);
        for (const site of sites) {
          const summary = await this.summaryWithin(tx, org, site.id, definition);
          rows.push({ ...site, summary });
          if (summary.totalKgCO2e !== null) total = total.add(summary.totalKgCO2e);
        }
        const complete = rows.length > 0 && rows.every((r) => r.summary.status === 'COMPLETE');
        const checkedAt = new Date().toISOString();
        return {
          portfolio,
          definition,
          checkedAt,
          scope: assignedOnly ? 'ASSIGNED_ACTIVE_SITES' : 'PORTFOLIO_ACTIVE_SITES',
          status: !rows.length ? 'EMPTY' : complete ? 'COMPLETE' : 'INCOMPLETE',
          totalKgCO2e: complete ? total.toFixed() : null,
          sites: rows.map((row) => ({ ...row, summary: { ...row.summary, checkedAt } })),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
  async trends(actor: Actor, org: string, input: unknown) {
    const definition = carbonTrendInput.parse(input);
    return this.db.$transaction(
      async (tx) => {
        const member = await this.membership(actor, org, undefined, tx);
        const assigned = member.role === 'SITE_MANAGER';
        const portfolio =
          definition.kind === 'portfolio'
            ? await tx.portfolio.findFirst({ where: { id: definition.id, organisationId: org, archivedAt: null } })
            : null;
        if (definition.kind === 'portfolio' && !portfolio)
          throw new DomainError('NOT_FOUND', 'This portfolio is unavailable.', 404);
        const sites = await tx.site.findMany({
          where: {
            organisationId: org,
            archivedAt: null,
            ...(definition.kind === 'site' ? { id: definition.id } : { portfolioId: definition.id }),
            ...(assigned ? { assignments: { some: { membershipId: member.id, organisationId: org } } } : {}),
          },
          select: { id: true, name: true, code: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        if (!sites.length && (assigned || definition.kind === 'site'))
          throw new DomainError('NOT_FOUND', 'This scope is unavailable.', 404);
        const meters = await tx.meter.findMany({
          where: { organisationId: org, siteId: { in: sites.map((s) => s.id) }, archivedAt: null },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        const years = [definition.comparisonYear, definition.year];
        const readings = await tx.consumptionRecord.findMany({
          where: {
            organisationId: org,
            meterId: { in: meters.map((m) => m.id) },
            replacement: { is: null },
            OR: years.map((year) => ({
              periodStart: { lt: new Date(`${year + 1}-01-01`) },
              periodEnd: { gt: new Date(`${year}-01-01`) },
            })),
          },
          select: { id: true, meterId: true, periodStart: true, periodEnd: true },
        });
        const factors = await tx.emissionFactorVersion.findMany({
          where: {
            organisationId: org,
            geography: definition.geography,
            basis: definition.basis,
            unit: 'kgCO2e/kWh',
            replacement: { is: null },
          },
          select: { id: true },
        });
        const factorIds = new Set(factors.map((f) => f.id));
        const series = [];
        for (const year of years) {
          const runs = new Map<string, TrendRun>();
          for (const meter of meters) {
            const run = await tx.carbonRun.findFirst({
              where: {
                organisationId: org,
                siteId: meter.siteId,
                AND: [
                  { snapshot: { path: ['definition', 'meterId'], equals: meter.id } },
                  { snapshot: { path: ['definition', 'year'], equals: year } },
                  { snapshot: { path: ['definition', 'geography'], equals: definition.geography } },
                  { snapshot: { path: ['definition', 'basis'], equals: definition.basis } },
                ],
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            });
            if (run)
              runs.set(meter.id, {
                id: run.id,
                algorithmVersion: run.algorithmVersion,
                createdAt: run.createdAt.toISOString(),
                snapshot: run.snapshot as unknown as CarbonSnapshot,
              });
          }
          const siteRows = sites.map((site) => {
            const months = carbonTrendPoints(
              year,
              meters.filter((m) => m.siteId === site.id),
              runs,
              readings,
              factorIds,
              carbonAlgorithmVersion,
            );
            return { ...site, months, totalKgCO2e: trendTotal(months) };
          });
          const months = aggregateTrend(siteRows.map((s) => s.months));
          series.push({ year, sites: siteRows, months, totalKgCO2e: trendTotal(months) });
        }
        return {
          version: 'carbon-trends-v1',
          checkedAt: new Date().toISOString(),
          definition,
          name: portfolio?.name ?? sites[0].name,
          scope: assigned
            ? 'Assigned active sites only'
            : definition.kind === 'site'
              ? 'Active site meters'
              : 'All active portfolio sites',
          series,
          change: trendChange(series[1].totalKgCO2e, series[0].totalKgCO2e),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }
  async report(
    actor: Actor,
    org: string,
    kind: 'site' | 'portfolio',
    id: string,
    input: unknown,
  ): Promise<CarbonReport> {
    const definition = carbonSummaryInput.parse(input);
    let report: Omit<CarbonReport, 'evidence'>;
    const note =
      'Sum of included active meters; overlapping main/submeter measurements are not deducted. Missing, blocked or outdated coverage withholds totals. Monthly evidence remains historical even if inputs later change. This export is a point-in-time report, not a live view.';
    if (kind === 'portfolio') {
      const summary = await this.portfolioSummary(actor, org, id, definition);
      report = {
        reportVersion: 'carbon-report-v1',
        organisationId: org,
        subject: { kind, ...summary.portfolio },
        scope: summary.scope,
        checkedAt: summary.checkedAt,
        definition,
        status: summary.status,
        totalKgCO2e: summary.totalKgCO2e,
        unit: 'kgCO2e',
        note,
        sites: summary.sites,
      };
    } else {
      const site = await this.getSite(actor, org, id);
      const summary = await this.summary(actor, org, id, definition);
      report = {
        reportVersion: 'carbon-report-v1',
        organisationId: org,
        subject: { kind, id: site.id, name: site.name },
        scope: 'SITE_ACTIVE_METERS',
        checkedAt: summary.checkedAt,
        definition,
        status: summary.status,
        totalKgCO2e: summary.totalKgCO2e,
        unit: 'kgCO2e',
        note,
        sites: [{ ...site, summary }],
      };
    }
    // Only immutable runs explicitly referenced by the authorized summary may enter the export.
    const runIds = [
      ...new Set(report.sites.flatMap((site) => site.summary.meters.flatMap((m) => (m.runId ? [m.runId] : [])))),
    ];
    const runs = await this.db.carbonRun.findMany({
      where: { organisationId: org, siteId: { in: report.sites.map((s) => s.id) }, id: { in: runIds } },
      orderBy: { id: 'asc' },
    });
    if (runs.length !== runIds.length)
      throw new DomainError('REPORT_EVIDENCE', 'Report evidence is unavailable. Refresh and try again.', 409);
    return {
      ...report,
      evidence: runs.map((run) => ({
        id: run.id,
        siteId: run.siteId,
        algorithmVersion: run.algorithmVersion,
        createdAt: run.createdAt.toISOString(),
        snapshot: run.snapshot as unknown as CarbonSnapshot,
      })),
    };
  }
  async calculate(actor: Actor, org: string, siteId: string, input: unknown) {
    const definition = carbonInput.parse(input);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.access(tx, actor, org, siteId, true);
      const existing = await tx.carbonRun.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: definition.requestKey } },
      });
      if (existing) {
        const saved = existing.snapshot as unknown as CarbonSnapshot;
        if (
          existing.siteId !== siteId ||
          Object.entries(definition).some(([key, value]) => saved.definition[key as keyof typeof definition] !== value)
        )
          throw new DomainError('REQUEST_CONFLICT', 'Use a new request key for a different calculation.', 409);
        return existing;
      }
      const meter = await tx.meter.findFirst({
        where: { id: definition.meterId, organisationId: org, siteId, archivedAt: null },
      });
      if (!meter) throw new DomainError('NOT_FOUND', 'This active meter is not available.', 404);
      const start = new Date(`${definition.year}-01-01`),
        end = new Date(`${definition.year + 1}-01-01`);
      const readings = await tx.consumptionRecord.findMany({
        where: {
          organisationId: org,
          siteId,
          meterId: meter.id,
          replacement: { is: null },
          periodStart: { lt: end },
          periodEnd: { gt: start },
        },
      });
      const factors = await tx.emissionFactorVersion.findMany({
        where: {
          organisationId: org,
          geography: definition.geography,
          basis: definition.basis,
          unit: 'kgCO2e/kWh',
          replacement: { is: null },
          validFrom: { lt: end },
          validUntil: { gt: start },
        },
      });
      let total = new Decimal(0);
      const rows: CarbonSnapshot['rows'] = Array.from({ length: 12 }, (_, i) => {
        const month = `${definition.year}-${String(i + 1).padStart(2, '0')}`;
        const period = monthPeriod(month);
        const candidates = readings.filter((r) => +r.periodStart < +period.end && +r.periodEnd > +period.start);
        if (
          candidates.length !== 1 ||
          +candidates[0].periodStart !== +period.start ||
          +candidates[0].periodEnd !== +period.end
        )
          return {
            month,
            issue: candidates.length ? 'Ambiguous or non-monthly consumption coverage.' : 'Missing consumption.',
          };
        const reading = candidates[0];
        const base = {
          month,
          readingId: reading.id,
          readingRevision: reading.revision,
          normalizedKwh: reading.normalizedKwh.toString(),
          conversionVersion: reading.conversionVersion,
          estimated: reading.estimated,
        };
        const matches = factors.filter(
          (f) => f.fuel === reading.fuel && +f.validFrom <= +period.start && +f.validUntil >= +period.end,
        );
        if (matches.length !== 1)
          return {
            ...base,
            issue:
              'A single factor must cover the whole month. Add complete coverage; mid-month changes are not prorated.',
          };
        const factor = matches[0];
        const kg = new Decimal(reading.normalizedKwh.toString()).mul(factor.factor.toString());
        total = total.add(kg);
        return {
          ...base,
          issue: null,
          factorId: factor.id,
          factorRevision: factor.revision,
          factor: factor.factor.toString(),
          source: factor.source,
          kgCO2e: kg.toFixed(),
        };
      });
      const blocked = rows.some((r) => r.issue);
      const snapshot: CarbonSnapshot = {
        definition,
        meter: { id: meter.id, name: meter.name, fuel: meter.fuel },
        status: blocked ? 'BLOCKED' : 'COMPLETE',
        totalKgCO2e: blocked ? null : total.toFixed(),
        rows,
      };
      const run = await tx.carbonRun.create({
        data: {
          organisationId: org,
          siteId,
          requestKey: definition.requestKey,
          algorithmVersion: carbonAlgorithmVersion,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          authorId: actor.userId,
        },
      });
      await this.audit(tx, actor, org, 'carbon.calculated', run.id, {
        siteId,
        meterId: meter.id,
        status: snapshot.status,
        algorithmVersion: carbonAlgorithmVersion,
      });
      return run;
    });
  }
}
