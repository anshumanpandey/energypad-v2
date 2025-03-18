import { UtilityService, DashboardService, SitesService } from '@services';
import { AppModels } from '@types';
import { DbUtils } from '@utils';
import Decimal from 'decimal.js';
import { calculateIncreasePercentage } from '../../utils/mathUtils';
import {
  getFuelSourcesFromConsumptionCollection,
  ProducedConsumption,
  ValueByRecord,
  wasteCost,
  WasteValue,
} from '../dashboard.service';
import { HDDRecord } from '../greenDays.service';
import { SupportedUses } from '../utility.service';
import { ApiError } from '@lib';

type DaylightParams = {
  daylight: ValueByRecord[];
  nextDaylight: ValueByRecord[];
};

type HddParams = {
  hdd: HDDRecord[];
  nextHdd: HDDRecord[];
};

type CddParams = {
  cdd: HDDRecord[];
  nextCdd: HDDRecord[];
};

type WasteSingleFuelParams = {
  consumptions: ProducedConsumption[];
  population: ValueByRecord[];
  time: ValueByRecord[];

  nextConsumptions: AppModels['UtilityConsumption'][];

  nextPopulation: ValueByRecord[];
  nextTime: ValueByRecord[];
  year: number;
};
const wasteForSinglefuelFunction = (params: WasteSingleFuelParams & HddParams) => {
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
        .times(normalisedTime);

        console.log(consumption.date, {c:passConsumption.consumption, normalisedHdd,normalisedPopulation,normalisedTime, initialWaste})

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

const wasteForHeatingOrCoolingAndPower = (params: WasteSingleFuelParams & HddParams & DaylightParams) => {
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
        .times(normalisedTime);

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

const wasteForHeatingAndCooling = (params: WasteSingleFuelParams & HddParams & CddParams) => {
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

      const passCdd = params.cdd.find(
        (h) =>
          h.siteId === consumption.siteId &&
          DbUtils.decreaseYear({ date: consumption.date }, 1) === DbUtils.dateToStringDate(h.date),
      );
      if (!passCdd) {
        continue;
      }
      const cdd = params.nextCdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!cdd) {
        continue;
      }
      const normalisedCdd = new Decimal(cdd.value).div(passCdd.value).toNumber();

      const initialWaste = new Decimal(passConsumption.consumption)
        .times(normalisedHdd)
        .times(normalisedCdd)
        .times(normalisedPopulation)
        .times(normalisedTime);

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

const wasteForHeatingAndCoolingAndPower = (params: WasteSingleFuelParams & HddParams & CddParams & DaylightParams) => {
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

      const passCdd = params.cdd.find(
        (h) =>
          h.siteId === consumption.siteId &&
          DbUtils.decreaseYear({ date: consumption.date }, 1) === DbUtils.dateToStringDate(h.date),
      );
      if (!passCdd) {
        continue;
      }
      const cdd = params.nextCdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!cdd) {
        continue;
      }
      const normalisedCdd = new Decimal(cdd.value).div(passCdd.value).toNumber();

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
        .times(normalisedCdd)
        .times(normalisedPopulation)
        .times(normalisedTime)
        .times(normalisedDaylight);

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

const wasteForLightingAndPower = (params: WasteSingleFuelParams & DaylightParams) => {
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
        .times(normalisedPopulation)
        .times(normalisedTime)
        .times(normalisedDaylight);

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

const calculateWaste = async (params: WasteSingleFuelParams & HddParams & CddParams & DaylightParams) => {
  const uses = await UtilityService.findFuelUseBy();
  const prevYearConsumptions = params.consumptions
    .filter(DashboardService.consumptionIsNotProduced)
    .filter(DbUtils.filterByYear(params.year - 1));
  const thisYearConsumptions = params.nextConsumptions
    .filter(DashboardService.consumptionIsNotProduced)
    .filter(DbUtils.filterByYear(params.year));

  const map = new Map<SupportedUses, 'old' | 'new'>();
  const fuels = getFuelSourcesFromConsumptionCollection(thisYearConsumptions);
  const usesToSearchOn: SupportedUses[] = ['Heating', 'Cooling', 'Powering', 'Lighting'];
  for (let i = 0; i < usesToSearchOn.length; i++) {
    for (let f = 0; f < fuels.length; f++) {
      const [use] = uses.filter((u) => u.use === usesToSearchOn[i]);
      const fuel = fuels[f];

      const thisConsumptions = thisYearConsumptions
        .filter(UtilityService.filterByFuelSource(fuel))
        .filter(UtilityService.filterByUse(use.id));
      const oldConsumptions = prevYearConsumptions
        .filter(UtilityService.filterByFuelSource(fuel))
        .filter(UtilityService.filterByUse(use.id));

      const currentYear = thisConsumptions.every((c) => c.fuelSourceId === fuel && c.usedInId === use.id);
      const prevYear = oldConsumptions.every((c) => c.fuelSourceId === fuel && c.usedInId === use.id);

      if (thisConsumptions.length !== 0 && currentYear === true) {
        map.set(use.use as SupportedUses, 'old');
      }

      if (oldConsumptions.length !== 0 && prevYear === true) {
        map.set(use.use as SupportedUses, 'new');
      }
    }
  }

  const heating = map.get('Heating');
  const cooling = map.get('Cooling');
  const powering = map.get('Powering');
  const lighting = map.get('Lighting');

  if ((lighting === 'old' && powering === 'new') || (powering === 'old' && lighting === 'new')) {
    const waste = wasteForLightingAndPower(params);
    return waste;
  }

  if (heating === 'old' && cooling === 'old' && powering === 'new') {
    const waste = wasteForHeatingAndCoolingAndPower(params);
    return waste;
  }

  if (heating === 'old' && cooling === 'new') {
    const waste = wasteForHeatingAndCooling(params);
    return waste;
  }

  if ((heating === 'old' || cooling === 'old') && powering === 'new') {
    const waste = wasteForHeatingOrCoolingAndPower(params);
    return waste;
  }

  if ((heating === 'old' || heating === 'new') || (cooling === 'old' || cooling === 'new')) {
    const waste = wasteForSinglefuelFunction(params);
    return waste;
  }

  return new ApiError('No formula found');
};

export const WasteCalculationV2 = {
  wasteForSinglefuelFunction,
  wasteForHeatingOrCoolingAndPower,
  wasteForHeatingAndCooling,
  wasteForHeatingAndCoolingAndPower,
  wasteForLightingAndPower,
  calculateWaste,
};
