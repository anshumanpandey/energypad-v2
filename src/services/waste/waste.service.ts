import { UtilityService, DashboardService, SitesService } from '@services';
import { AppModels } from '@types';
import { DbUtils } from '@utils';
import Decimal from 'decimal.js';
import { calculateIncreasePercentage } from '../../utils/mathUtils';
import { ProducedConsumption, ValueByRecord, wasteCost, WasteValue } from '../dashboard.service';
import { HDDRecord } from '../greenDays.service';

type WasteSingleFuelParams = {
  consumptions: ProducedConsumption[];
  hdd: HDDRecord[];
  population: ValueByRecord[];
  time: ValueByRecord[];

  nextConsumptions: AppModels['UtilityConsumption'][];
  nextHdd: HDDRecord[];

  nextPopulation: ValueByRecord[];
  nextTime: ValueByRecord[];
  year: number;
};
const wasteForSinglefuelFunction = (params: WasteSingleFuelParams) => {
  const results: (WasteValue & { projectedEnergy: number; cIntercept: number })[] = [];
  const fuelSources = Array.from(
    new Set(params.consumptions.concat(params.nextConsumptions).map((i) => i.fuelSourceId)).values(),
  );
  for (let i = 0; i < fuelSources.length; i++) {
    const currentFuelSourceId = fuelSources[i];
    const passConsumptions = params.consumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year - 1))
      .filter(DashboardService.consumptionIsNotProduced);
    const passHdds = params.hdd
      .filter(DbUtils.filterByYear(params.year - 1))
      .filter(DashboardService.consumptionIsNotProduced);

    const currentFuelSourceNextConsumption = params.nextConsumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year));

    for (let i = 0; i < currentFuelSourceNextConsumption.length; i++) {
      const consumption = currentFuelSourceNextConsumption[i];
      if (DashboardService.consumptionIsProduced(consumption)) {
        continue;
      }

      const [passConsumption] = passConsumptions
        .filter(UtilityService.filterByFuelSource(consumption.fuelSourceId))
        .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear({ date: consumption.date }, 1) }))
        .filter(SitesService.filterBySiteId(consumption.siteId));

      const passHdd = passHdds.find(
        (h) =>
          h.siteId === consumption.siteId &&
          DbUtils.decreaseYear({ date: consumption.date }, 1) === DbUtils.dateToStringDate(h.date),
      );
      if (!passHdd) {
        continue;
      }
      const hdd = params.nextHdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!hdd) {
        continue;
      }
      const normalisedHdd = new Decimal(hdd.value).div(passHdd.value).toNumber();

      const passPopulation = params.population.find(
        (h) => h.siteId === consumption.siteId && DbUtils.decreaseYear({ date: consumption.date }, 1) === h.date,
      );
      if (!passPopulation) {
        continue;
      }
      const population = params.nextPopulation.find(
        (h) => h.siteId === consumption.siteId && consumption.date === h.date,
      );
      if (!population) {
        continue;
      }
      const normalisedPopulation = new Decimal(population.value).div(passPopulation.value).toNumber();

      const passTime = params.time.find(
        (h) => h.siteId === consumption.siteId && DbUtils.decreaseYear({ date: consumption.date }, 1) === h.date,
      );
      if (!passTime) {
        continue;
      }
      const time = params.nextTime.find((h) => h.siteId === consumption.siteId && consumption.date === h.date);
      if (!time) {
        continue;
      }
      const normalisedTime = new Decimal(time.value).div(passTime.value).toNumber();

      const initialWaste = new Decimal(passConsumption.consumption)
        .times(normalisedHdd)
        .times(normalisedPopulation)
        .times(normalisedTime)

      const pastValue = results.find(
        (r) =>
          r.siteId === consumption.siteId &&
          r.fuelSourceId === consumption.fuelSourceId &&
          r.usedIn === consumption.usedIn &&
          r.date === DbUtils.decreaseMonth({ date: consumption.date }, 1),
      );

      const waste = new Decimal(initialWaste).minus(consumption.consumption).toDP(2).toNumber();

      results.push({
        waste,
        wasteCost: wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.totalCost, waste }),
        wasteVatCost: consumption.vatCost
          ? wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.vatCost, waste })
          : null,
        date: consumption.date,
        consumption: consumption.consumption,
        projectedEnergy: 0,
        fuelSourceId: consumption.fuelSourceId,
        siteId: consumption.siteId,
        fuelSourceName: consumption.fuelSourceName,
        siteName: consumption.siteName,
        cIntercept: 0,
        usedIn: consumption.usedIn,
        increasedPercentage: pastValue
          ? calculateIncreasePercentage({ passValue: pastValue?.waste, currentValue: waste })
          : 0,
      });
    }
  }
  return results;
};

const wasteForHeatingOrCoolingAndPower = (params: WasteSingleFuelParams & { daylight: ValueByRecord[]; nextDaylight: ValueByRecord[] }) => {
  const results: (WasteValue & { projectedEnergy: number; cIntercept: number })[] = [];
  const fuelSources = Array.from(
    new Set(params.consumptions.concat(params.nextConsumptions).map((i) => i.fuelSourceId)).values(),
  );
  for (let i = 0; i < fuelSources.length; i++) {
    const currentFuelSourceId = fuelSources[i];
    const passConsumptions = params.consumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year - 1))
      .filter(DashboardService.consumptionIsNotProduced);
    const passHdds = params.hdd
      .filter(DbUtils.filterByYear(params.year - 1))
      .filter(DashboardService.consumptionIsNotProduced);

    const currentFuelSourceNextConsumption = params.nextConsumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year));

    for (let i = 0; i < currentFuelSourceNextConsumption.length; i++) {
      const consumption = currentFuelSourceNextConsumption[i];
      if (DashboardService.consumptionIsProduced(consumption)) {
        continue;
      }

      const [passConsumption] = passConsumptions
        .filter(UtilityService.filterByFuelSource(consumption.fuelSourceId))
        .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear({ date: consumption.date }, 1) }))
        .filter(SitesService.filterBySiteId(consumption.siteId));

      const passHdd = passHdds.find(
        (h) =>
          h.siteId === consumption.siteId &&
          DbUtils.decreaseYear({ date: consumption.date }, 1) === DbUtils.dateToStringDate(h.date),
      );
      if (!passHdd) {
        continue;
      }
      const hdd = params.nextHdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!hdd) {
        continue;
      }
      const normalisedHdd = new Decimal(hdd.value).div(passHdd.value).toNumber();

      const passPopulation = params.population.find(
        (h) => h.siteId === consumption.siteId && DbUtils.decreaseYear({ date: consumption.date }, 1) === h.date,
      );
      if (!passPopulation) {
        continue;
      }
      const population = params.nextPopulation.find(
        (h) => h.siteId === consumption.siteId && consumption.date === h.date,
      );
      if (!population) {
        continue;
      }
      const normalisedPopulation = new Decimal(population.value).div(passPopulation.value).toNumber();

      const passTime = params.time.find(
        (h) => h.siteId === consumption.siteId && DbUtils.decreaseYear({ date: consumption.date }, 1) === h.date,
      );
      if (!passTime) {
        continue;
      }
      const time = params.nextTime.find((h) => h.siteId === consumption.siteId && consumption.date === h.date);
      if (!time) {
        continue;
      }
      const normalisedTime = new Decimal(time.value).div(passTime.value).toNumber();


      const passDaylight = params.daylight.find(
        (h) => h.siteId === consumption.siteId && DbUtils.decreaseYear({ date: consumption.date }, 1) === h.date,
      );
      if (!passDaylight) {
        continue;
      }
      const daylight = params.nextDaylight.find((h) => h.siteId === consumption.siteId && consumption.date === h.date);
      if (!daylight) {
        continue;
      }
      const normalisedDaylight = new Decimal(passDaylight.value).div(daylight.value).toNumber();

      const initialWaste = new Decimal(passConsumption.consumption)
        .times(normalisedHdd)
        .times(normalisedDaylight)
        .times(normalisedPopulation)
        .times(normalisedTime)

      const pastValue = results.find(
        (r) =>
          r.siteId === consumption.siteId &&
          r.fuelSourceId === consumption.fuelSourceId &&
          r.usedIn === consumption.usedIn &&
          r.date === DbUtils.decreaseMonth({ date: consumption.date }, 1),
      );

      const waste = new Decimal(initialWaste).minus(consumption.consumption).toDP(6).toNumber();

      results.push({
        waste,
        wasteCost: wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.totalCost, waste }),
        wasteVatCost: consumption.vatCost
          ? wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.vatCost, waste })
          : null,
        date: consumption.date,
        consumption: consumption.consumption,
        projectedEnergy: 0,
        fuelSourceId: consumption.fuelSourceId,
        siteId: consumption.siteId,
        fuelSourceName: consumption.fuelSourceName,
        siteName: consumption.siteName,
        cIntercept: 0,
        usedIn: consumption.usedIn,
        increasedPercentage: pastValue
          ? calculateIncreasePercentage({ passValue: pastValue?.waste, currentValue: waste })
          : 0,
      });
    }
  }
  return results;
};


export const WasteCalculationV2 = {
  wasteForSinglefuelFunction,
  wasteForHeatingOrCoolingAndPower
};
