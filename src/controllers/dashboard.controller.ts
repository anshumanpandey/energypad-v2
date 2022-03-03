import { ApiError } from '@lib';
import { UtilityService, DashboardService, UserService, GreenDaysServices } from '@services';
import { AuthGetAppController } from '@types';
import { DbUtils, MathUtils } from '@utils';
import { endOfMonth, formatISO, addYears, endOfYear, subMonths, setMonth } from 'date-fns';
import { HDDRecord } from '../services/greenDays.service';

export const getDataByYear: AuthGetAppController<'GetDashboardData', '/api/dashboard/'> = async (req) => {
  const business = await UserService.getUserBy({ id: req.user.id });

  const previousYear = (MathUtils.toInt(req.query.year) || new Date().getFullYear()) - 1;
  const yearToFilterBy = new Date(previousYear, 0, 1);
  const selectedYear = addYears(yearToFilterBy, 1);
  const lastMonthOfPassYear = subMonths(selectedYear, 1);
  const lastDayOfCurrentMonth = endOfMonth(setMonth(selectedYear, new Date().getMonth()));

  const [oldConsumptions, currentConsumptionRecords, currentYearAllSourcesConsumption] = await Promise.all([
    DashboardService.produceYearConsumptions({
      businessId: req.user.id,
      startDate: yearToFilterBy,
      endDate: endOfYear(yearToFilterBy),
      fuelSourceId: MathUtils.toInt(req.query.fuelSourceId),
      siteId: parseInt(req.query.siteId),
    }),
    DashboardService.produceYearConsumptions(
      {
        businessId: req.user.id,
        startDate: lastMonthOfPassYear,
        endDate: endOfYear(selectedYear),
        fuelSourceId: MathUtils.toInt(req.query.fuelSourceId),
        siteId: parseInt(req.query.siteId),
      },
      { fillStartOnly: true },
    ),
    UtilityService.getConsumptions({
      businessId: req.user.id,
      startDate: lastMonthOfPassYear,
      endDate: lastDayOfCurrentMonth,
      siteId: parseInt(req.query.siteId),
    }),
  ]);

  let statistics: {
    date: string;
    consumption: number;
    projectedEnergy: number;
  }[] = [];

  const allConsumptionAreProduced = currentConsumptionRecords.every(DashboardService.consumptionIsProduced);
  if (allConsumptionAreProduced === false && oldConsumptions.length > 0 && currentConsumptionRecords.length > 0) {
    const mapRecords = (r: typeof oldConsumptions[0]) => {
      const startDate = r.date;

      const date = DbUtils.stringDateToDate(r.date);
      const endOfMonthDate = endOfMonth(date);
      const endDate = formatISO(endOfMonthDate, { representation: 'date' }).split('T')[0];
      return { startDate, endDate };
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
        });

  return {
    consumptions: consumptions,
    energyTargets: statistics,
    consumptionsDetails: consumptionsDetails,
  };
};
