import { ApiError } from '@lib';
import { UtilityService, DashboardService, UserService, GreenDaysServices, SitesService, ConversionUnitService } from '@services';
import { AuthGetAppController, AppModels } from '@types';
import { DbUtils, MathUtils, ErrorUtils, AppUtils } from '@utils';
import { endOfMonth, formatISO, addYears, endOfYear, subMonths, setMonth, subYears } from 'date-fns';
import { CarbonEmission, ProducedConsumption, WasteValue } from '../services/dashboard.service';
import { GetHddsParams2, HDDRecord, isCdd, isHdd } from '../services/greenDays.service';
import { ConsummingStaticsticsParams, GetConsumptionsParams, Projection } from '../services/utility.service';
import { filterByYearAndMonth } from '../utils/dbUtils';
import { ONE_OF_SUPPORTED_UNIT, resolveConsumptionToKwh } from '../utils/unitsUtils';
import { agroupBy } from '../utils/appUtils';
import { WasteCalculationV2 } from '../services/waste/waste.service';
import Rand from 'rand-seed';
import multi_nrv_hdd from './multi_nrv_hdd';
import single_rv_hdd from './single_rv_hdd';
import multi_adjustment_hdd from './multi_adjustment_hdd';

const consumptionToBreakdown = (r: AppModels['UtilityConsumption']) => {
  const startDate = r.date;

  const date = DbUtils.stringDateToDate(r.date);
  const endOfMonthDate = endOfMonth(date);
  const endDate = formatISO(endOfMonthDate, { representation: 'date' }).split('T')[0];
  return { startDate, endDate, siteId: r.siteId };
};

export const getDataByYear = async (req: any) => {
  const year = (MathUtils.toInt(req.query.year) || new Date().getFullYear()) - 1;
  const selectedYear = new Date(year + 1, 0, 1);
  const lastMonthOfPassYear = subMonths(selectedYear, 1);
  const lastDayOfCurrentMonth = setMonth(selectedYear, 11);

  const currenMonthParams = {
    businessId: req.user.id,
    startDate: lastMonthOfPassYear,
    endDate: lastDayOfCurrentMonth,
    fuelSourceId: req.query?.fuelSourceId ? MathUtils.toInt(req.query.fuelSourceId) : undefined,
    siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
  };
  const [currentConsumptionRecords, currentYearAllSourcesConsumption] = await Promise.all([
    DashboardService.produceYearConsumptions(currenMonthParams),
    UtilityService.getConsumptions({
      businessId: req.user.id,
      startDate: lastMonthOfPassYear,
      endDate: lastDayOfCurrentMonth,
      siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
    }),
  ]);

  let statistics: Projection[][] = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && currentConsumptionRecords.length > 0) {
    const energyParams: ConsummingStaticsticsParams = {
      currentConsumptionRecords,
      year: selectedYear.getFullYear(),
    };

    statistics = await UtilityService.consumingProjection(energyParams);
    if (statistics instanceof ApiError) return statistics;
  }

  const consumptionsDetails = DashboardService.getConsumptionDetails({
    consumptions: currentYearAllSourcesConsumption.sort(DbUtils.sortByStringDate),
    year: selectedYear,
  });

  const consumptions =
    allConsumptionAreProduced === true
      ? []
      : DashboardService.getConsumptionStatistics({
          consumptions: currentConsumptionRecords
            .filter(DashboardService.consumptionIsNotProduced)
            .sort(DbUtils.sortByStringDate),
          year: selectedYear,
        })
          .map((i) => i.filter((c) => c.consumption !== 0))
          .filter((i) => i.length !== 0)
          .map((arr) =>
            arr.sort(AppUtils.sortByProp(req.query?.order ? 'consumption' : 'date', req.query?.order || 'asc')),
          );
  return {
    consumptions,
    energyTargets: statistics
      .map((arr) => arr.filter(DashboardService.consumptionIsNotProduced))
      .filter((i) => i.length !== 0),
    consumptionsDetails,
  };
};

//TODO:  fix this enpoint definition
//export const getReporData: AuthGetAppController<'GetDashboardReports', '/api/dashboard/reports'> = async (req) => {
export const getReporData: any = async (req: any) => {
  const previousYear = (MathUtils.toInt(req.query.year) || new Date().getFullYear()) - 1;
  const yearToFilterBy = new Date(previousYear, 0, 1);
  const selectedYear = addYears(yearToFilterBy, 1);

  const [business] = await Promise.all([UserService.getUserBy({ id: req.user.id })]);

  const params: GetConsumptionsParams = {
    siteId: MathUtils.toInt(req.query.siteId),
    businessId: req.user.id,
  };

  const lastMonthOfPassYear = subMonths(selectedYear, 1);
  const fuelSourceId = req.query.fuelSourceId ? req.query.fuelSourceId.split(',').map(MathUtils.toInt) : undefined;
  const siteId = MathUtils.toInt(req.query.siteId);

  const [oldConsumptions, currentConsumptionRecords] = await Promise.all([
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: yearToFilterBy,
      endDate: endOfYear(yearToFilterBy),
      fuelSourceId,
      siteId,
    }),
    DashboardService.produceYearConsumptions(
      {
        businessId: req.user.id,
        startDate: lastMonthOfPassYear,
        endDate: endOfYear(selectedYear),
        fuelSourceId,
        siteId,
      },
      { fillStartOnly: true },
    ),
  ]);

  let statistics: {
    date: string;
    consumption: number;
    projectedEnergy: number;
    saving: number;
  }[][] = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && oldConsumptions.length > 0 && currentConsumptionRecords.length > 0) {
    const mapRecords = (r: typeof oldConsumptions[0]) => {
      const startDate = r.date;

      const date = DbUtils.stringDateToDate(r.date);
      const endOfMonthDate = endOfMonth(date);
      const endDate = formatISO(endOfMonthDate, { representation: 'date' }).split('T')[0];
      return { startDate, endDate, siteId: r.siteId };
    };

    const promises: Promise<ApiError | HDDRecord[]>[] = [];
    if (oldConsumptions.length !== 0) {
      const params = {
        postalCode: business.postCode,
        breakDowns: oldConsumptions.sort(DbUtils.sortByStringDate).map(mapRecords),
        valuesToGet: ['HDD' as const],
      };

      promises.push(GreenDaysServices.getHdds(params));
    }
    if (currentConsumptionRecords.length !== 0) {
      const params = {
        postalCode: business.postCode,
        breakDowns: currentConsumptionRecords.sort(DbUtils.sortByStringDate).map(mapRecords),
        valuesToGet: ['HDD' as const],
      };
      promises.push(GreenDaysServices.getHdds(params));
    }

    const [pastHdds, currentHdd] = await Promise.all(promises);
    if (pastHdds instanceof ApiError) return pastHdds;
    if (currentHdd instanceof ApiError) return currentHdd;

    const energyParams = {
      pastConsumptionRecords: oldConsumptions,
      pastHdds,
      currentConsumptionRecords,
      currentHdd,
      year: selectedYear.getFullYear(),
    };

    statistics = await UtilityService.consumingProjection(energyParams);
    if (statistics instanceof ApiError) return statistics;
  }

  const consumptionsForSelectedMonth = await UtilityService.getConsumptions({
    businessId: req.user.id,
    siteId,
    fuelSourceId,
  });

  let carbonEmissions: CarbonEmission[] = [];

  if (consumptionsForSelectedMonth.length > 0) {
    const emissions = await UtilityService.getEmissions({
      businessId: req.user.id,
      siteId,
      fuelSourceId,
    });

    const targets = await ConversionUnitService.getTargetConsumption({
      siteId,
    });

    carbonEmissions = DashboardService.findCarbonEmissions({
      forYear: selectedYear,
      targets,
      emissions,
      allConsumptions: consumptionsForSelectedMonth,
    });
  }

  params.forYear = new Date(MathUtils.toInt(req.query.year), 0, 1);

  let records = await UtilityService.getConsumptions(params);

  const totalYearReports = records.length;

  if (req.query.year) {
    records = records.filter((i) => {
      const d = new Date(MathUtils.toInt(req.query.year), 0, 1);
      return i.date.slice(0, 7) === d.toISOString().split('T')[0].slice(0, 7);
    });
  }

  return {
    energyTargets: statistics,
    reports: records,
    carbonEmissions,
    totalYearReports,
  };
};

export const getcarbonFootprint: AuthGetAppController<'GetDashboardCarbonFootprint', '/api/dashboard/carbonFootprint'> =
  async (req) => {
    const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
    const selectedYear = new Date(year, 0, 1);

    const siteId = req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined;
    const fuelSourceId = req.query.fuelSourceId ? MathUtils.toInt(req.query.fuelSourceId) : undefined;

    const consumptionParams = {
      businessId: req.user.id,
      siteId,
      startDate: subMonths(selectedYear, 1),
      endDate: endOfYear(selectedYear),
    };
    const [consumptionsForSelectedMonth, fuelSources] = await Promise.all([
      UtilityService.getConsumptions(consumptionParams),
      UtilityService.getFuelSources(),
    ]);

    let carbonEmissions: CarbonEmission[] = [];
    let allCarbonEmissions: CarbonEmission[] = [];

    const filteredConsumptions = fuelSourceId
      ? consumptionsForSelectedMonth.filter(UtilityService.filterByFuelSource(fuelSourceId))
      : consumptionsForSelectedMonth;
    if (filteredConsumptions.length > 0) {
      const emissions = await UtilityService.getEmissions({
        businessId: req.user.id,
        siteId,
      });

      const targets = await ConversionUnitService.getTargetConsumption({
        siteId,
      });

      const [result1, result2] = await Promise.all([
        DashboardService.findCarbonEmissions(
          {
            targets: targets,
            forYear: selectedYear,
            emissions,
            allConsumptions: filteredConsumptions,
            fuels: fuelSources,
          },
          { ignoreFuelSource: fuelSourceId === undefined },
        ),
        DashboardService.findCarbonEmissions(
          {
            targets: targets,
            emissions,
            allConsumptions: consumptionsForSelectedMonth,
            fuels: fuelSources,
          },
          { ignoreFuelSource: fuelSourceId === undefined },
        ),
      ]);

      carbonEmissions = result1 ? result1 : [];
      allCarbonEmissions = result2 ? result2.filter(DbUtils.filterByYear(selectedYear.getFullYear())) : [];
    }

    return {
      carbonEmissions: AppUtils.agroupByDate(
        carbonEmissions.sort(AppUtils.sortByProp('carbonEmission', req.query?.order || 'asc')),
      ),
      allCarbonEmissions: AppUtils.agroupByDate(allCarbonEmissions),
    };
  };

//TODO:  fix this enpoint definition
//export const getReportData: AuthGetAppController<'GetDashboardPortfolio', '/api/dashboard/portfolio'> = async (req) => {
export const getPortfolioData: any = async (req: any) => {
  const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
  const fuelSourceId = MathUtils.toInt(req.query.fuelSourceId);
  const selectedYear = new Date(year, 0, 1);

  const [sites] = await Promise.all([
    SitesService.findBy({ businessId: req.user.id, fuelSourceIdUsedInConsumption: fuelSourceId, includeUse: true }),
  ]);
  const sitesId = sites.map((i) => i.id);

  const [consumptions, fuelSources, patterns] = await Promise.all([
    UtilityService.getConsumptions({
      businessId: req.user.id,
      siteId: sitesId,
      startDate: subMonths(selectedYear, 1),
      endDate: selectedYear,
      fuelSourceId,
    }),
    UtilityService.getFuelSources(),
    UserService.getPatterns({ siteId: sitesId, businessId: req.user.id }),
  ]);

  const [emissions, targets] = await Promise.all([
    UtilityService.getEmissions({
      businessId: req.user.id,
      siteId: sitesId,
      fuelSourceId,
    }),
    ConversionUnitService.getTargetConsumption({
      siteId: sitesId,
    }),
  ]);

  const carbonEmissions = DashboardService.findCarbonEmissions({
    targets,
    forYear: selectedYear,
    emissions,
    allConsumptions: consumptions,
    fuels: fuelSources,
  });

  const [oldConsumptions, currentConsumptionRecords] = await Promise.all([
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: subMonths(subYears(selectedYear, 1), 1),
      endDate: subYears(selectedYear, 1),
      fuelSourceId: MathUtils.toInt(req.query.fuelSourceId),
      siteId: sitesId,
    }),
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: subMonths(selectedYear, 1),
      endDate: endOfMonth(selectedYear),
      fuelSourceId: MathUtils.toInt(req.query.fuelSourceId),
      siteId: sitesId,
    }),
  ]);

  let statistics: {
    date: string;
    consumption: number;
    projectedEnergy: number;
    saving: number;
  }[][] = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && oldConsumptions.length > 0 && currentConsumptionRecords.length > 0) {
    const promises: Promise<ApiError | HDDRecord[]>[] = [];
    if (oldConsumptions.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: oldConsumptions.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }

      promises.push(GreenDaysServices.getHdds2(params));
    }
    if (currentConsumptionRecords.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: currentConsumptionRecords.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }

      promises.push(GreenDaysServices.getHdds2(params));
    }

    const [pastHdds, currentHdd] = await Promise.all(promises);
    if (pastHdds instanceof ApiError) return pastHdds;
    if (currentHdd instanceof ApiError) return currentHdd;

    const energyParams = {
      pastConsumptionRecords: oldConsumptions,
      pastHdds,
      currentConsumptionRecords,
      currentHdd,
      year: selectedYear.getFullYear(),
    };

    statistics = await UtilityService.consumingProjection(energyParams);
    if (ErrorUtils.isErrorInstance(statistics)) return statistics;
  }

  const findSiteById = (i: number) => (s: typeof sites[0]) => {
    return s.id === i;
  };

  const addSitesData = (i: any) => {
    return {
      ...i,
      siteAddress: sites.find(findSiteById(i.siteId))?.address,
    };
  };

  return {
    carbonEmissions: carbonEmissions.map(addSitesData),
    energyTargets: statistics.map(addSitesData),
    sites,
  };
};

export const energyWaste: any = async (req: any) => {
  const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
  const fuelSource =
    req.query?.fuelSource && Number.isNaN(req.query.fuelSource) === false
      ? MathUtils.toInt(req.query.fuelSource)
      : undefined;
  const siteId: number | number[] | undefined = req.query?.siteId
    ? Array.isArray(req.query.siteId)
      ? req.query.siteId.map(MathUtils.toInt)
      : MathUtils.toInt(req.query.siteId)
    : undefined;
  const selectedYear = new Date(year, 0, 1);

  const [fuelSources, patterns, sites] = await Promise.all([
    UtilityService.getFuelSources({ id: fuelSource }),
    UserService.getPatterns({ siteId: siteId, businessId: req.user.id }),
    SitesService.findBy({ id: siteId, businessId: req.user.id }),
  ]);

  const oldParams = {
    businessId: req.user.id,
    startDate: subYears(selectedYear, 2),
    endDate: endOfYear(subYears(selectedYear, 1)),
    siteId,
  };
  const newParams = {
    businessId: req.user.id,
    startDate: subMonths(selectedYear, 1),
    endDate: endOfYear(selectedYear),
    siteId,
  };
  const [oldConsumptions, currentConsumptionRecords] = await Promise.all([
    DashboardService.produceYearConsumptions(oldParams),
    DashboardService.produceYearConsumptions(newParams),
  ]);

  let wasteData: Awaited<ReturnType<typeof WasteCalculationV2.calculateWaste>> = [];
  let projections: Awaited<ReturnType<typeof UtilityService.consumingProjection>> = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && currentConsumptionRecords.length > 0 && oldConsumptions.length > 0) {
    const promises: Promise<ApiError | HDDRecord[]>[] = [];
    if (oldConsumptions.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: oldConsumptions.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }

      promises.push(GreenDaysServices.getHdds2(params));
    }
    if (currentConsumptionRecords.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: currentConsumptionRecords.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }
      promises.push(GreenDaysServices.getHdds2(params));
    }

    const [pastHdds, currentHdd] = await Promise.all(promises);
    if (pastHdds instanceof ApiError) return pastHdds;
    if (currentHdd instanceof ApiError) return currentHdd;

    const drivers = await DashboardService.getSiteDrivers({
      siteId: Array.from(new Set(oldConsumptions.map((c) => c.siteId)).values()),
    });

    const siteId = oldConsumptions[0].siteId;

    const replaceSiteId = <T = { siteId: number }>(r: T) => ({ ...r, siteId });
    const filterPassYear = (y: number) => (c: ProducedConsumption) => c.date.split("-")[0] === y.toString()

    const energyParams: Parameters<typeof WasteCalculationV2.calculateWaste>[0] = {
      drivers,
      consumptions: oldConsumptions,
      hdd: multi_nrv_hdd.oldHdd.map(replaceSiteId),
      nextConsumptions: currentConsumptionRecords,
      nextHdd: multi_nrv_hdd.nextHdd.map(replaceSiteId),
      year,

      population: oldConsumptions.filter(filterPassYear(year - 1)).map((c) => ({
        siteId: c.siteId,
        value: c.population,
        date: c.date,
      })),
      nextPopulation: currentConsumptionRecords.filter(filterPassYear(year)).map((c) => ({
        siteId: c.siteId,
        value: c.population,
        date: c.date,
      })),

      time: multi_nrv_hdd.hours.map(replaceSiteId),
      nextTime: multi_nrv_hdd.nextHours.map(replaceSiteId),

      daylight: multi_nrv_hdd.daylight.map(replaceSiteId),
      nextDaylight: multi_nrv_hdd.nextDaylight.map(replaceSiteId),
    };

    wasteData = await WasteCalculationV2.calculateWaste(energyParams);
    if (ErrorUtils.isErrorInstance(wasteData)) {
      return wasteData;
    }

    const projectionParams = {
      pastConsumptionRecords: oldConsumptions,
      pastHdds,
      currentConsumptionRecords,
      currentHdd,
      year: selectedYear.getFullYear(),
    };
    projections = await UtilityService.consumingProjection(projectionParams);
    if (projections instanceof ApiError) return projections;
  }

  const emissions = await UtilityService.getEmissions({
    businessId: req.user.id,
    siteId,
    fuelSourceId: req.query.fuelSourceId,
  });

  const targets = await ConversionUnitService.getTargetConsumption({
    siteId,
  });

  const carbonEmissions = DashboardService.findCarbonEmissions(
    {
      targets ,
      emissions,
      allConsumptions: currentConsumptionRecords,
      fuels: fuelSources,
    },
    { ignoreFuelSource: req.query.fuelSourceId === undefined },
  );

  return {
    waste: agroupBy(wasteData, 'fuelSourceId'),
    consumptions: currentConsumptionRecords,
    targetConsumptions: projections,
    carbonEmissions: carbonEmissions.map((i) => {
      const waste = (
        wasteData as (WasteValue & {
          projectedEnergy: number;
          cIntercept: number;
        })[]
      )
        .filter(filterByYearAndMonth(i))
        .filter(SitesService.filterBySiteId(i.siteId))?.[0]?.waste;
      let carbonEmission = 0;
      if (waste) {
        carbonEmission = resolveConsumptionToKwh({
          consumption: waste,
          fuelUnit: i.fuelUnit as ONE_OF_SUPPORTED_UNIT,
          conversionFactor: i.conversionFactor,
        });
      }

      return {
        ...i,
        carbonEmission,
      };
    }),
    financialCost: DashboardService.calculateFinancialCost({
      consumptions: currentConsumptionRecords,
      waste: wasteData,
    }),
  };
};

export const reports: any = async (req: any) => {
  const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
  const fuelSourceId = req.query.fuelSourceId ? MathUtils.toInt(req.query.fuelSourceId) : undefined;
  const selectedYear = new Date(year, 0, 1);
  const siteId = req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined;

  const [fuelSources, emissions, patterns] = await Promise.all([
    UtilityService.getFuelSources({ id: fuelSourceId }),
    UtilityService.getEmissions({
      businessId: req.user.id,
      siteId,
      forYear: new Date(year, 0, 1),
      fuelSourceId,
    }),
    UserService.getPatterns({ siteId: siteId, businessId: req.user.id }),
  ]);

  const fuelSourceToUse = fuelSources.map(AppUtils.getRecordId);
  const oldParams = {
    businessId: req.user.id,
    startDate: subYears(selectedYear, 2),
    endDate: endOfYear(subYears(selectedYear, 1)),
    siteId,
  };
  const [oldConsumptions, currentConsumptionRecords, sites] = await Promise.all([
    DashboardService.produceYearConsumptions(oldParams),
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: subMonths(selectedYear, 1),
      endDate: endOfYear(selectedYear),
      siteId,
    }),
    SitesService.findBy({ id: siteId }),
  ]);

  let statistics: Awaited<ReturnType<typeof WasteCalculationV2.calculateWaste>> = [];
  let targetConsumptions: Awaited<ReturnType<typeof UtilityService.consumingProjection>> = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && currentConsumptionRecords.length > 0 && oldConsumptions.length > 0) {
    const consumptionToBreakdown = (r: typeof oldConsumptions[0]) => {
      const startDate = r.date;

      const date = DbUtils.stringDateToDate(r.date);
      const endOfMonthDate = endOfMonth(date);
      const endDate = formatISO(endOfMonthDate, { representation: 'date' }).split('T')[0];
      return { startDate, endDate, siteId: r.siteId };
    };

    const promises: Promise<ApiError | HDDRecord[]>[] = [];
    if (oldConsumptions.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: oldConsumptions.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }

      promises.push(GreenDaysServices.getHdds2(params));
    }
    if (currentConsumptionRecords.length !== 0) {
      const params: GetHddsParams2[] = [];
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const pattern = patterns.find((p) => p.siteId === s.id);
        if (!pattern) {
          continue;
        }
        params.push({
          temperature: pattern.temperature,
          postalCode: s.postCode,
          siteId: s.id,
          breakDowns: currentConsumptionRecords.sort(DbUtils.sortByStringDate).map(consumptionToBreakdown),
          valuesToGet: ['HDD', 'CDD'],
        });
      }
      promises.push(GreenDaysServices.getHdds2(params));
    }

    const [pastHdds, currentHdd] = await Promise.all(promises);
    if (pastHdds instanceof ApiError) return pastHdds;
    if (currentHdd instanceof ApiError) return currentHdd;

    const drivers = await DashboardService.getSiteDrivers({
      siteId: Array.from(new Set(oldConsumptions.map((c) => c.siteId)).values()),
    });

    const replaceSiteId = <T = { siteId: number }>(r: T) => ({ ...r, siteId });
    const filterPassYear = (y: number) => (c: ProducedConsumption) => c.date.split("-")[0] === y.toString()
    const energyParams: Parameters<typeof WasteCalculationV2.calculateWaste>[0] = {
      drivers,
      consumptions: oldConsumptions,
      hdd: multi_nrv_hdd.oldHdd.map(replaceSiteId),
      nextConsumptions: currentConsumptionRecords,
      nextHdd: multi_nrv_hdd.nextHdd.map(replaceSiteId),
      year,

      population: oldConsumptions.filter(filterPassYear(year - 1)).map((c) => ({
        siteId: c.siteId,
        value: c.population,
        date: c.date,
      })),
      nextPopulation: currentConsumptionRecords.filter(filterPassYear(year)).map((c) => ({
        siteId: c.siteId,
        value: c.population,
        date: c.date,
      })),

      time: multi_nrv_hdd.hours.map(replaceSiteId),
      nextTime: multi_nrv_hdd.nextHours.map(replaceSiteId),

      daylight: multi_nrv_hdd.daylight.map(replaceSiteId),
      nextDaylight: multi_nrv_hdd.nextDaylight.map(replaceSiteId),
    };

    statistics = await WasteCalculationV2.calculateWaste(energyParams);
    if (statistics instanceof ApiError) {
      return statistics;
    }
    const projectionParams = {
      pastConsumptionRecords: oldConsumptions,
      pastHdds,
      currentConsumptionRecords,
      currentHdd,
      year: selectedYear.getFullYear(),
    };
    targetConsumptions = await UtilityService.consumingProjection(projectionParams);
    if (ErrorUtils.isErrorInstance(targetConsumptions)) return targetConsumptions;
  }

  const targets = await ConversionUnitService.getTargetConsumption({
    siteId,
  });

  const carbonEmissions = DashboardService.findCarbonEmissions({
    forYear: selectedYear,
    targets,
    emissions,
    allConsumptions: currentConsumptionRecords,
    fuels: fuelSources.filter((f) => fuelSourceToUse.includes(f.id)),
  });

  let carbonImpact: ReturnType<typeof DashboardService.calculateCarbonImpact> = [];
  if (statistics.length !== 0) {
    carbonImpact = DashboardService.calculateCarbonImpact({
      consumptions: currentConsumptionRecords,
      emissions,
      waste: statistics,
    });
  }

  return {
    reports: carbonImpact
      .map((c) => {
        const found = (
          statistics as (WasteValue & {
            projectedEnergy: number;
            cIntercept: number;
          })[]
        )
          .filter(filterByYearAndMonth(c))
          .filter(SitesService.filterBySiteId(c.siteId))
          .filter(UtilityService.filterByFuelSource(c.fuelSourceId))?.[0];
        return {
          ...c,
          wasteCost: found?.wasteCost,
          waste: found?.waste,
        };
      })
      .filter((i) => i.produced !== true),
    targetConsumptions: targetConsumptions
      .map((r) => r.filter(DashboardService.consumptionIsNotProduced))
      .filter((r) => r.length !== 0),
    //TODO: consumptions and carbonEmissions should be agroup by fuelSourceId AND siteId
    consumptions: agroupBy(currentConsumptionRecords, 'fuelSourceId').map((r) =>
      r.filter(DashboardService.consumptionIsNotProduced),
    ),
    carbonEmissions: agroupBy(carbonEmissions, 'fuelSourceId').map((r) =>
      r.filter(DashboardService.consumptionIsNotProduced),
    ),
  };
};
