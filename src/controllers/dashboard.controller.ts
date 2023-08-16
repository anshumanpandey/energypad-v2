import { ApiError } from '@lib';
import { UtilityService, DashboardService, UserService, GreenDaysServices, SitesService } from '@services';
import { AuthGetAppController } from '@types';
import { DbUtils, MathUtils, ErrorUtils, AppUtils } from '@utils';
import { endOfMonth, formatISO, addYears, endOfYear, subMonths, setMonth, subYears, addMonths } from 'date-fns';
import { CarbonEmission } from '../services/dashboard.service';
import { HDDRecord } from '../services/greenDays.service';
import { GetConsumptionsParams, Projection } from '../services/utility.service';

export const getDataByYear = async (req: any) => {
  const business = await UserService.getUserBy({ id: req.user.id });

  const previousYear = (MathUtils.toInt(req.query.year) || new Date().getFullYear()) - 1;
  const yearToFilterBy = new Date(previousYear, 0, 1);
  const selectedYear = addYears(yearToFilterBy, 1);
  const lastMonthOfPassYear = subMonths(selectedYear, 1);
  const lastDayOfCurrentMonth = endOfMonth(setMonth(selectedYear, new Date().getMonth()));

  const currenMonthParams = {
    businessId: req.user.id,
    startDate: lastMonthOfPassYear,
    endDate: addMonths(selectedYear, 11),
    fuelSourceId: req.query?.fuelSourceId ? MathUtils.toInt(req.query.fuelSourceId) : undefined,
    siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
  };
  const [oldConsumptions, currentConsumptionRecords, currentYearAllSourcesConsumption] = await Promise.all([
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: yearToFilterBy,
      endDate: endOfYear(yearToFilterBy),
      fuelSourceId: req.query?.fuelSourceId ? MathUtils.toInt(req.query.fuelSourceId) : undefined,
      siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
    }),
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
  if (allConsumptionAreProduced === false && oldConsumptions.length > 0 && currentConsumptionRecords.length > 0) {
    const removedDuplicatedDates = (value: typeof oldConsumptions[0], index: number, self: typeof oldConsumptions) =>
      index === self.findIndex((t: any) => t.date === value.date);
    const mapRecords = (r: typeof oldConsumptions[0]) => {
      const startDate = r.date;

      const date = DbUtils.stringDateToDate(r.date);
      const endOfMonthDate = endOfMonth(date);
      const endDate = DbUtils.dateToStringDate(endOfMonthDate);
      return { startDate, endDate, siteId: r.siteId };
    };

    const promises: Promise<ApiError | HDDRecord[]>[] = [];
    if (oldConsumptions.length !== 0) {
      const params = {
        postalCode: business.postCode,
        breakDowns: oldConsumptions
          .sort(DbUtils.sortByStringDate)
          .filter(DashboardService.consumptionIsNotProduced)
          .filter(removedDuplicatedDates)
          .map(mapRecords),
        valuesToGet: ['HDD' as const],
      };

      promises.push(GreenDaysServices.getHdds(params));
    }
    if (currentConsumptionRecords.length !== 0) {
      const params = {
        postalCode: business.postCode,
        breakDowns: currentConsumptionRecords
          .sort(DbUtils.sortByStringDate)
          .filter(DashboardService.consumptionIsNotProduced)
          .filter(removedDuplicatedDates)
          .map(mapRecords),
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

  const consumptionsDetails = DashboardService.getConsumptionDetails({
    consumptions: currentYearAllSourcesConsumption.sort(DbUtils.sortByStringDate),
  });

  const consumptions =
    allConsumptionAreProduced === true
      ? []
      : DashboardService.getConsumptionStatistics({
          consumptions: currentConsumptionRecords.sort(DbUtils.sortByStringDate),
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
    consumptionsDetails: consumptionsDetails,
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

    carbonEmissions = DashboardService.findCarbonEmissions({
      forYear: selectedYear,
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

      const [result1, result2] = await Promise.all([
        DashboardService.findCarbonEmissions(
          {
            forYear: selectedYear,
            emissions,
            allConsumptions: filteredConsumptions,
            fuels: fuelSources,
          },
          { ignoreFuelSource: fuelSourceId === undefined },
        ),
        DashboardService.findCarbonEmissions(
          {
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
    debugger;
    return {
      carbonEmissions: carbonEmissions.sort(AppUtils.sortByProp('carbonEmission', req.query?.order || 'asc')),
      allCarbonEmissions: allCarbonEmissions,
    };
  };

//TODO:  fix this enpoint definition
//export const getReportData: AuthGetAppController<'GetDashboardPortfolio', '/api/dashboard/portfolio'> = async (req) => {
export const getReportData: any = async (req: any) => {
  const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
  const month = req.query.month !== undefined ? MathUtils.toInt(req.query.month) : new Date().getMonth();
  const fuelSourceId = MathUtils.toInt(req.query.fuelSourceId);
  const selectedYear = new Date(year, month, 1);

  const [sites, business] = await Promise.all([
    SitesService.findBy({ businessId: req.user.id }),
    UserService.getUserBy({ id: req.user.id }),
  ]);
  const sitesId = sites.map((i) => i.id);

  const [consumptions, fuelSources] = await Promise.all([
    UtilityService.getConsumptions({
      businessId: req.user.id,
      siteId: sitesId,
      startDate: subMonths(selectedYear, 1),
      endDate: selectedYear,
      fuelSourceId,
    }),
    UtilityService.getFuelSources(),
  ]);

  const emissions = await UtilityService.getEmissions({
    businessId: req.user.id,
    siteId: sitesId,
    fuelSourceId,
  });

  const carbonEmissions = DashboardService.findCarbonEmissions({
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
    if (ErrorUtils.isErrorInstance(statistics)) return statistics;
  }

  const filterByParamMonth = (i: typeof carbonEmissions[0]) => {
    return DbUtils.stringDateToDate(i.date).getMonth() === month;
  };

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
    carbonEmissions: carbonEmissions.filter(filterByParamMonth).map(addSitesData),
    energyTargets: statistics.map(addSitesData),
  };
};

//TODO:  fix this enpoint definition
//export const getEnergyWaste: AuthGetAppController<'GetDashboardEnergyWaste', '/api/dashboard/energyWaste'> = async (
export const getEnergyWaste: any = async (req: any) => {
  const year = MathUtils.toInt(req.query.year) || new Date().getFullYear();
  const siteId = MathUtils.toInt(req.query.siteId) || new Date().getFullYear();
  const selectedYear = new Date(year, 0, 1);

  const [business, fuelSources] = await Promise.all([
    UserService.getUserBy({ id: req.user.id }),
    UtilityService.getFuelSources(),
  ]);

  const [oldConsumptions, currentConsumptionRecords] = await Promise.all([
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: subYears(selectedYear, 1),
      endDate: endOfYear(subYears(selectedYear, 1)),
      fuelSourceId: fuelSources.map(AppUtils.getRecordId),
      siteId: siteId,
    }),
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: subMonths(selectedYear, 1),
      endDate: endOfYear(selectedYear),
      fuelSourceId: fuelSources.map(AppUtils.getRecordId),
      siteId: siteId,
    }),
  ]);

  let statistics: {
    date: string;
    consumption: number;
    projectedEnergy: number;
    saving: number;
    siteId: number;
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
    if (ErrorUtils.isErrorInstance(statistics)) return statistics;
  }

  return {
    energyTargets: statistics.sort(AppUtils.sortByProp('consumption', req.query?.order || 'asc')),
  };
};
