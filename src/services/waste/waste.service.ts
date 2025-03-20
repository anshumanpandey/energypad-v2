import { UtilityService, DashboardService, SitesService } from '@services';
import { AppModels } from '@types';
import { DbUtils } from '@utils';
import Decimal from 'decimal.js';
import { calculateIncreasePercentage } from '../../utils/mathUtils';
import {
  ProducedConsumption,
  ValueByRecord,
  wasteCost,
  WasteValue,
} from '../dashboard.service';
import { HDDRecord, isCdd, isHdd } from '../greenDays.service';
import { filterByIsOnUse } from '../utility.service';
import { ApiError } from '@lib';
import { filterByYear } from '../../utils/dbUtils';

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

const Resolvers = {
  isFirstSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const all = oldData.concat(newData);
  
    const fuels = Array.from(new Set(all.map((i) => i.fuelSourceId)));
    if (
      all.length !== 0 &&
      fuels.length === 1 &&
      (all.every((c) => c.usedIn === 'Heating') || all.every((c) => c.usedIn === 'Cooling'))
    ) {
      return true;
    }
  
    return false;
  },
  isSecondSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const oldPowering = oldData.filter((c) => c.usedIn === 'Powering');
    const newPowering = newData.filter((c) => c.usedIn === 'Powering');
    const allPowering = oldPowering.concat(newPowering);
  
    if (oldPowering.length === 0 || newPowering.length === 0 || Array.from(new Set(allPowering.map(r => r.fuelSourceId))).length !== 1) {
      return false;
    }
  
    const validUses = ['Heating', 'Cooling'];
    for (let i = 0; i < validUses.length; i++) {
      const use = validUses[i];
      const oldRecords = oldData.filter((c) => c.usedIn === use);
      const newRecords = newData.filter((c) => c.usedIn === use);
      if (oldRecords.length !== 0 && newRecords.length !== 0) {
        return true;
      }
    }
    return false;
  },
  isThirdSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const allData = oldData.concat(newData)
    if (Array.from(new Set(allData.map(r => r.fuelSourceId))).length !== 1) {
      return false
    }

    const validUses = ['Heating', 'Cooling'];
    let counter = 0;
    for (let i = 0; i < validUses.length; i++) {
      const use = validUses[i];
      const oldRecords = oldData.filter((c) => c.usedIn === use);
      const newRecords = newData.filter((c) => c.usedIn === use);
      if (oldRecords.length !== 0 && newRecords.length !== 0) {
        counter++;
      }
    }
    return counter === 2
  },
  isFourthSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const allData = oldData.concat(newData)
    if (Array.from(new Set(allData.map(r => r.fuelSourceId))).length !== 1) {
      return false
    }

    const validUses = ['Heating', 'Cooling', 'Powering'];
    let counter = 0;
    for (let i = 0; i < validUses.length; i++) {
      const use = validUses[i];
      const oldRecords = oldData.filter((c) => c.usedIn === use);
      const newRecords = newData.filter((c) => c.usedIn === use);
      if (oldRecords.length !== 0 && newRecords.length !== 0) {
        counter++;
      }
    }
    return counter === 3
  },
  isFifthSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const allData = oldData.concat(newData)
    if (Array.from(new Set(allData.map(r => r.fuelSourceId))).length !== 1) {
      return false
    }

    const validUses = ['Lighting', 'Powering'];
    let counter = 0;
    for (let i = 0; i < validUses.length; i++) {
      const use = validUses[i];
      const oldRecords = oldData.filter((c) => c.usedIn === use);
      const newRecords = newData.filter((c) => c.usedIn === use);
      if (oldRecords.length !== 0 && newRecords.length !== 0) {
        counter++;
      }
    }
    return counter === 2
  }
}

const calculateWaste = async (params: WasteSingleFuelParams & HddParams & CddParams & DaylightParams) => {

  if (false) {
    const waste = wasteForLightingAndPower(params);
    return waste;
  }

  if (Resolvers.isFourthSheet(params.consumptions, params.nextConsumptions)) {
    const consumptions = await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), "Heating");
    consumptions.push(...await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), "Cooling"))
    const nextConsumptions = await filterByIsOnUse(params.nextConsumptions.filter(filterByYear(params.year)), "Powering");

    const p = {
      ...params,
      nextHdd: params.nextHdd.filter(isHdd),
      nextCdd: params.nextCdd.filter(isCdd),
      consumptions,
      nextConsumptions
    }
    const waste = wasteForHeatingAndCoolingAndPower(p);

    return waste;
  }

  if (Resolvers.isThirdSheet(params.consumptions, params.nextConsumptions)) {
    const waste = wasteForHeatingAndCooling({
      ...params,
      nextHdd: params.nextHdd.filter(isHdd),
      nextCdd: params.nextCdd.filter(isCdd)
    });
    return waste;
  }

  if (Resolvers.isSecondSheet(params.consumptions, params.nextConsumptions)) {
    const consumptions = await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), "Heating");
    consumptions.push(...await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), "Cooling"))
    const nextConsumptions = await filterByIsOnUse(params.nextConsumptions.filter(filterByYear(params.year)), "Powering");

    const p = {
      ...params,
      consumptions,
      nextConsumptions
    };

    const waste = wasteForHeatingOrCoolingAndPower(p);
    return waste;
  }

  if (Resolvers.isFirstSheet(params.consumptions, params.nextConsumptions)) {
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
