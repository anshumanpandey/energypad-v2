import { UtilityService, DashboardService, SitesService } from '@services';
import { AppModels } from '@types';
import { DbUtils } from '@utils';
import Decimal from 'decimal.js';
import { Matrix, solve } from 'ml-matrix';
import { calculateIncreasePercentage } from '../../utils/mathUtils';
import { ProducedConsumption, ValueByRecord, wasteCost, WasteValue } from '../dashboard.service';
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
  const results: (WasteValue & { projectedEnergy: number; cIntercept: number; significant: boolean })[] = [];
  const fuelSources = Array.from(
    new Set(params.consumptions.concat(params.nextConsumptions).map((i) => i.fuelSourceId)).values(),
  );
  for (let i = 0; i < fuelSources.length; i++) {
    const currentFuelSourceId = fuelSources[i];
    const passConsumptions = params.consumptions.filter(
      (c) =>
        UtilityService.filterByFuelSource(currentFuelSourceId)(c) &&
        DashboardService.consumptionIsNotProduced(c) &&
        (DbUtils.filterByYear(params.year - 1)(c) || DbUtils.filterByYear(params.year - 2)(c)),
    );

    const passHdds = params.hdd.filter(
      (c) =>
        //TODO: add site id to filter
        DashboardService.consumptionIsNotProduced(c) &&
        (DbUtils.filterByYear(params.year - 1) || DbUtils.filterByYear(params.year - 2)),
    );

    const currentFuelSourceNextConsumption = params.nextConsumptions.filter(
      (c) => UtilityService.filterByFuelSource(currentFuelSourceId)(c) && DbUtils.filterByYear(params.year)(c),
    );

    const hddConsumption: { date: string; value: number }[] = [];
    const hddPow: { date: string; value: number }[] = [];

    for (let i = 0; i < passConsumptions.length; i++) {
      const consumption = passConsumptions[i];

      const passHdd = passHdds.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!passHdd) {
        continue;
      }
      const hddTimesConsumption = new Decimal(passHdd.value).times(consumption.consumption).toNumber();
      hddConsumption.push({ date: consumption.date, value: hddTimesConsumption });
      const hddPow2 = new Decimal(passHdd.value).pow(2).toNumber();
      hddPow.push({ date: consumption.date, value: hddPow2 });
    }

    const totalHdd = passHdds.reduce((total, hdd) => total.plus(hdd.value), new Decimal(0)).toNumber();
    const totalOfConsumption = passConsumptions
      .reduce((total, c) => total.plus(c.consumption), new Decimal(0))
      .toNumber();
    const totalOfHddConsumption = hddConsumption.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfHddPow = hddPow.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();

    const slopeB = new Decimal(
      new Decimal(passConsumptions.length)
        .times(totalOfHddConsumption)
        .minus(new Decimal(totalHdd).times(totalOfConsumption)),
    )
      .div(new Decimal(passConsumptions.length).times(totalOfHddPow).minus(new Decimal(totalHdd).pow(2)))
      .toNumber();

    const cIntercept = new Decimal(new Decimal(totalOfConsumption).minus(new Decimal(slopeB).times(totalHdd)))
      .div(passConsumptions.length)
      .toNumber();

    const consumptionAvg = new Decimal(totalOfConsumption).div(passConsumptions.length).toNumber();

    const consumptionDeficit: { date: string; siteId: number; fuelSourceId: number; value: number }[] = [];
    const consumptionResidual: { date: string; siteId: number; fuelSourceId: number; value: number }[] = [];
    for (let i = 0; i < passConsumptions.length; i++) {
      const consumption = passConsumptions[i];

      const passHdd = passHdds.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!passHdd) {
        continue;
      }

      const fittedConsumption = new Decimal(new Decimal(slopeB).times(passHdd.value)).plus(cIntercept).toNumber();
      const residualConsumption = new Decimal(consumption.consumption).minus(fittedConsumption).toNumber();
      const residualPow = new Decimal(residualConsumption).pow(2).toNumber();
      consumptionResidual.push({
        date: consumption.date,
        siteId: consumption.siteId,
        fuelSourceId: consumption.fuelSourceId,
        value: residualPow,
      });
      const deficit = new Decimal(consumption.consumption).minus(consumptionAvg).pow(2).toNumber();
      consumptionDeficit.push({
        date: consumption.date,
        siteId: consumption.siteId,
        fuelSourceId: consumption.fuelSourceId,
        value: deficit,
      });
    }

    const totalResidual = consumptionResidual
      .reduce((total, next) => total.plus(next.value), new Decimal(0))
      .toNumber();
    const tot = consumptionDeficit.reduce((total, next) => total.plus(next.value), new Decimal(0)).toNumber();
    const R2 = new Decimal(1).minus(new Decimal(totalResidual).div(tot));
    const regretion = new Decimal(totalResidual).div(22).squareRoot();
    const IPMVPThreshold = new Decimal(regretion).times(2);

    for (let i = 0; i < currentFuelSourceNextConsumption.length; i++) {
      const consumption = currentFuelSourceNextConsumption[i];
      if (DashboardService.consumptionIsProduced(consumption)) {
        continue;
      }

      const passHdd = passHdds.find(
        (h) =>
          h.siteId === consumption.siteId &&
          DbUtils.decreaseYear({ date: consumption.date }, 1) === DbUtils.dateToStringDate(h.date),
      );
      if (!passHdd) {
        continue;
      }
      const currentHdd = params.nextHdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!currentHdd) {
        continue;
      }

      const expectedConsumption = new Decimal(slopeB).times(currentHdd.value).plus(cIntercept);
      const waste = new Decimal(expectedConsumption).minus(consumption.consumption).absoluteValue();
      const significant = waste.greaterThanOrEqualTo(IPMVPThreshold);

      const pastValue = results.find(
        (r) =>
          r.siteId === consumption.siteId &&
          r.fuelSourceId === consumption.fuelSourceId &&
          r.usedIn === consumption.usedIn &&
          r.date === DbUtils.decreaseMonth({ date: consumption.date }, 1),
      );

      results.push({
        waste: waste.toDP(2).toNumber(),
        significant,
        wasteCost: wasteCost({
          consumption: consumption.consumption,
          consumptionCost: consumption.totalCost,
          waste: waste.toNumber(),
        }),
        wasteVatCost: consumption.vatCost
          ? wasteCost({
              consumption: consumption.consumption,
              consumptionCost: consumption.vatCost,
              waste: waste.toNumber(),
            })
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
          ? calculateIncreasePercentage({ passValue: pastValue?.waste, currentValue: waste.toNumber() })
          : 0,
      });
    }
  }
  return results;
};

function linest3Variable(hdd: number[], cdd: number[], daylighting: number[], consumption: number[]) {
  const rows = consumption.length;

  // Build X matrix
  const X: number[][] = [];

  for (let i = 0; i < rows; i++) {
    X.push([
      1, // Intercept
      hdd[i],
      cdd[i],
      daylighting[i],
    ]);
  }

  const Xmat = new Matrix(X);
  const Ymat = Matrix.columnVector(consumption);

  // Compute components for OLS: (X'X)β = X'Y
  const Xt = Xmat.transpose();
  const XtX = Xt.mmul(Xmat);
  const XtY = Xt.mmul(Ymat);

  // FIX: Pass the matrices directly into the standalone solve() function
  const beta = solve(XtX, XtY);

  return {
    baseload: beta.get(0, 0),
    hddSlope: beta.get(1, 0),
    cddSlope: beta.get(2, 0),
    daylightingSlope: beta.get(3, 0),
  };
}

const wasteForHeatingOrCoolingAndPower = (params: WasteSingleFuelParams & HddParams & DaylightParams) => {
  const results: (WasteValue & { projectedEnergy: number; cIntercept: number; significant: boolean })[] = [];
  const fuelSources = Array.from(
    new Set(params.consumptions.concat(params.nextConsumptions).map((i) => i.fuelSourceId)).values(),
  );
  for (let i = 0; i < fuelSources.length; i++) {
    const currentFuelSourceId = fuelSources[i];
    const passConsumptions = params.consumptions.filter(
      (c) =>
        UtilityService.filterByFuelSource(currentFuelSourceId)(c) &&
        DashboardService.consumptionIsNotProduced(c) &&
        (DbUtils.filterByYear(params.year - 1)(c) || DbUtils.filterByYear(params.year - 2)(c)),
    );

    const currentFuelSourceNextConsumption = params.nextConsumptions.filter(
      (c) => UtilityService.filterByFuelSource(currentFuelSourceId)(c) && DbUtils.filterByYear(params.year)(c),
    );

    const hddConsumption: { date: string; value: number }[] = [];
    const cddConsumption: { date: string; value: number }[] = [];
    const daylightConsumption: { date: string; value: number }[] = [];
    const hddPow: { date: string; value: number }[] = [];
    const cddPow: { date: string; value: number }[] = [];
    const daylightPow: { date: string; value: number }[] = [];
    const hddTimesCdd: { date: string; value: number }[] = [];
    const hddTimesDaylight: { date: string; value: number }[] = [];
    const cddTimesDaylight: { date: string; value: number }[] = [];

    for (let i = 0; i < passConsumptions.length; i++) {
      const consumption = passConsumptions[i];

      const passHdd = params.hdd.find(
        (h) =>
          h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date) && h.kind === 'HDD',
      );
      if (!passHdd) {
        continue;
      }

      const passCdd = params.hdd.find(
        (h) =>
          h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date) && h.kind === 'CDD',
      );
      if (!passCdd) {
        continue;
      }

      const passDaylight = params.daylight.find((h) => h.siteId === consumption.siteId && consumption.date === h.date);
      if (!passDaylight) {
        continue;
      }

      const hddTimesConsumption = new Decimal(passHdd.value).times(consumption.consumption).toNumber();
      hddConsumption.push({ date: consumption.date, value: hddTimesConsumption });

      const cddTimesConsumption = new Decimal(passCdd.value).times(consumption.consumption).toNumber();
      cddConsumption.push({ date: consumption.date, value: cddTimesConsumption });

      const daylightTimeConsumption = new Decimal(passDaylight.value).times(consumption.consumption).toNumber();
      daylightConsumption.push({ date: consumption.date, value: daylightTimeConsumption });

      const hddPow2 = new Decimal(passHdd.value).pow(2).toNumber();
      hddPow.push({ date: consumption.date, value: hddPow2 });

      const cddPow2 = new Decimal(passCdd.value).pow(2).toNumber();
      cddPow.push({ date: consumption.date, value: cddPow2 });

      const daylightPow2 = new Decimal(passDaylight.value).pow(2).toNumber();
      daylightPow.push({ date: consumption.date, value: daylightPow2 });

      const hddCdd = new Decimal(passHdd.value).times(passCdd.value).toNumber();
      hddTimesCdd.push({ date: consumption.date, value: hddCdd });

      const hddDaylight = new Decimal(passHdd.value).times(passDaylight.value).toNumber();
      hddTimesDaylight.push({ date: consumption.date, value: hddDaylight });

      const cddDaylight = new Decimal(passCdd.value).times(passDaylight.value).toNumber();
      cddTimesDaylight.push({ date: consumption.date, value: cddDaylight });
    }

    const totalHdd = params.hdd
      .filter((h) => h.kind === 'HDD')
      .reduce((total, hdd) => total.plus(hdd.value), new Decimal(0))
      .toNumber();
    const totalCdd = params.hdd
      .filter((h) => h.kind === 'CDD')
      .reduce((total, hdd) => total.plus(hdd.value), new Decimal(0))
      .toNumber();
    const totalDaylight = params.daylight.reduce((total, day) => total.plus(day.value), new Decimal(0)).toNumber();
    const totalOfConsumption = passConsumptions
      .reduce((total, c) => total.plus(c.consumption), new Decimal(0))
      .toNumber();
    const totalOfHddConsumption = hddConsumption.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfCddConsumption = cddConsumption.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfDaylightConsumption = daylightConsumption
      .reduce((total, c) => total.plus(c.value), new Decimal(0))
      .toNumber();
    const totalOfHddPow = hddPow.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfCddPow = cddPow.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfDaylightPow = daylightPow.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfHddCdd = hddTimesCdd.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfHddDaylight = hddTimesDaylight.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();
    const totalOfCddDaylight = cddTimesDaylight.reduce((total, c) => total.plus(c.value), new Decimal(0)).toNumber();

    const sample = linest3Variable(
      params.hdd.filter((h) => h.kind === 'HDD').map((h) => h.value),
      params.hdd.filter((h) => h.kind === 'CDD').map((h) => h.value),
      params.daylight.map((h) => h.value),
      params.consumptions.map((c) => c.consumption),
    );

    const residualPow2: { date: string; value: number }[] = [];
    const residualNet: { date: string; value: number }[] = [];
    for (let i = 0; i < passConsumptions.length; i++) {
      const consumption = passConsumptions[i];

      const passHdd = params.hdd.find(
        (h) =>
          h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date) && h.kind === 'HDD',
      );
      if (!passHdd) {
        continue;
      }

      const passCdd = params.hdd.find(
        (h) =>
          h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date) && h.kind === 'CDD',
      );
      if (!passCdd) {
        continue;
      }

      const passDaylight = params.daylight.find((h) => h.siteId === consumption.siteId && consumption.date === h.date);
      if (!passDaylight) {
        continue;
      }

      const fittedConsumption = new Decimal(
        new Decimal(sample.baseload).plus(new Decimal(sample.hddSlope).times(passHdd.value)),
      ).plus(
        new Decimal(sample.cddSlope)
          .times(passCdd.value)
          .plus(new Decimal(sample.daylightingSlope).times(passDaylight.value)),
      );

      const residual = new Decimal(consumption.consumption).minus(fittedConsumption);
      const residualPow = new Decimal(residual).pow(2);
      residualPow2.push({ date: consumption.date, value: residualPow.toNumber() });

      const consumptionAvg = passConsumptions
        .reduce((total, next) => total.plus(next.consumption), new Decimal(0))
        .div(passConsumptions.length)
        .toNumber();
      const net = new Decimal(consumption.consumption).minus(new Decimal(consumptionAvg)).pow(2);
      residualNet.push({ date: DbUtils.increaseYear({ date: consumption.date }, 1), value: net.toNumber() });
    }

    const residualTotal = residualPow2.reduce((total, next) => total.plus(next.value), new Decimal(0));
    const netTotal = residualNet.reduce((total, next) => total.plus(next.value), new Decimal(0));
    const residualDivNet = new Decimal(1).minus(new Decimal(residualTotal).div(netTotal));

    const regresion = new Decimal(residualTotal).div(20).squareRoot();

    const expectedWaste: { date: string; value: number }[] = [];
    const waste: { date: string; value: number }[] = [];

    for (let i = 0; i < currentFuelSourceNextConsumption.length; i++) {
      const consumption = currentFuelSourceNextConsumption[i];
      if (DashboardService.consumptionIsProduced(consumption)) {
        continue;
      }

      const currentHdd = params.nextHdd.find(
        (h) =>
          h.kind === 'HDD' && h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!currentHdd) continue;
      const currentCdd = params.nextHdd.find(
        (h) =>
          h.kind === 'CDD' && h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!currentCdd) continue;
      const currentDaylight = params.nextDaylight.find(
        (h) => h.siteId === consumption.siteId && consumption.date === h.date,
      );
      if (!currentDaylight) continue;

      const expectedConsumption = new Decimal(sample.baseload)
        .plus(new Decimal(sample.hddSlope).times(currentHdd.value))
        .plus(new Decimal(sample.cddSlope).times(currentCdd.value))
        .plus(new Decimal(sample.daylightingSlope).times(currentDaylight.value));

        // row 59
      expectedWaste.push({ date: consumption.date, value: expectedConsumption.toNumber() });

      const saved = expectedConsumption.minus(consumption.consumption);
      waste.push({ date: consumption.date, value: saved.toNumber() });
    }

    const nraWaste: { date: string, value: number }[] = []
    for (let i = 0; i < params.nextTime.length; i++) {
      const currentTime = params.nextTime[i];
      const passTime = params.time.find(
        (t) => t.date === DbUtils.decreaseYear({ date: currentTime.date }, 1) && t.siteId === currentTime.siteId,
      );
      if (!passTime) continue;

      const changedTimePercentage = new Decimal(new Decimal(currentTime.value).minus(passTime.value))
        .div(passTime.value)
        .times(100);

      const passPopulation = params.population.find(
        (t) => t.date === DbUtils.decreaseYear({ date: currentTime.date }, 1) && t.siteId === currentTime.siteId,
      );
      if (!passPopulation) continue;

      const currentPopulation = params.nextPopulation.find(
        (t) => t.date === currentTime.date && t.siteId === currentTime.siteId,
      );
      if (!currentPopulation) continue;

      const changedPopulationPercentage = new Decimal(new Decimal(currentPopulation.value).minus(passPopulation.value))
        .div(passPopulation.value)
        .times(100);

      const nraFactor = new Decimal(new Decimal(currentTime.value).div(passTime.value))
        .times(new Decimal(currentPopulation.value).div(passPopulation.value))

        const expectedSaving = expectedWaste.find((t) => t.date === currentTime.date);
      if (!expectedSaving) continue;

      const nraAdjusted = new Decimal(expectedSaving.value).times(nraFactor);

      const currentConsumption = params.nextConsumptions.find((t) => t.date === currentTime.date);
      if (!currentConsumption) continue;

      const waste = new Decimal(nraAdjusted).minus(currentConsumption.consumption)

      // row 80
      nraWaste.push({ date: currentConsumption.date, value: waste.toNumber() })
    }

    const IPMVPThreshold = new Decimal(2).times(regresion)
    for (let i = 0; i < nraWaste.length; i++) {
      const waste = nraWaste[i];

      const consumption = params.nextConsumptions.find((t) => t.date === waste.date);
      if (!consumption) continue;

      const significant = new Decimal(waste.value).abs().greaterThanOrEqualTo(IPMVPThreshold)

      const pastValue = results.find(
        (r) =>
          r.siteId === consumption.siteId &&
          r.fuelSourceId === consumption.fuelSourceId &&
          r.usedIn === consumption.usedIn &&
          r.date === DbUtils.decreaseMonth({ date: consumption.date }, 1),
      );

      results.push({
        waste: new Decimal(waste.value).toDP(2).toNumber(),
        significant,
        wasteCost: wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.totalCost, waste: waste.value }),
        wasteVatCost: consumption.vatCost
          ? wasteCost({ consumption: consumption.consumption, consumptionCost: consumption.vatCost, waste: waste.value })
          : null,
        date: waste.date,
        consumption: consumption.consumption,
        projectedEnergy: 0,
        fuelSourceId: consumption.fuelSourceId,
        siteId: consumption.siteId,
        fuelSourceName: consumption.fuelSourceName,
        siteName: consumption.siteName,
        cIntercept: 0,
        usedIn: consumption.usedIn,
        increasedPercentage: pastValue
          ? calculateIncreasePercentage({ passValue: pastValue?.waste, currentValue: waste.value })
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

    if (
      oldPowering.length === 0 ||
      newPowering.length === 0 ||
      Array.from(new Set(allPowering.map((r) => r.fuelSourceId))).length !== 1
    ) {
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
    const allData = oldData.concat(newData);
    if (Array.from(new Set(allData.map((r) => r.fuelSourceId))).length !== 1) {
      return false;
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
    return counter === 2;
  },
  isFourthSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const allData = oldData.concat(newData);
    if (Array.from(new Set(allData.map((r) => r.fuelSourceId))).length !== 1) {
      return false;
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
    return counter === 3;
  },
  isFifthSheet: (oldData: ProducedConsumption[], newData: ProducedConsumption[]) => {
    const allData = oldData.concat(newData);
    if (Array.from(new Set(allData.map((r) => r.fuelSourceId))).length !== 1) {
      return false;
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
    return counter === 2;
  },
};

const calculateWaste = async (params: WasteSingleFuelParams & HddParams & CddParams & DaylightParams) => {
  if (Resolvers.isFifthSheet(params.consumptions, params.nextConsumptions)) {
    const consumptions = await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), 'Lighting');
    const nextConsumptions = await filterByIsOnUse(
      params.nextConsumptions.filter(filterByYear(params.year)),
      'Powering',
    );

    const p = {
      ...params,
      nextHdd: params.nextHdd.filter(isHdd),
      nextCdd: params.nextCdd.filter(isCdd),
      consumptions,
      nextConsumptions,
    };

    const waste = wasteForLightingAndPower(p);
    return waste;
  }

  if (Resolvers.isFourthSheet(params.consumptions, params.nextConsumptions)) {
    const consumptions = await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), 'Heating');
    consumptions.push(...(await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), 'Cooling')));
    const nextConsumptions = await filterByIsOnUse(
      params.nextConsumptions.filter(filterByYear(params.year)),
      'Powering',
    );

    const p = {
      ...params,
      nextHdd: params.nextHdd.filter(isHdd),
      nextCdd: params.nextCdd.filter(isCdd),
      consumptions,
      nextConsumptions,
    };
    const waste = wasteForHeatingAndCoolingAndPower(p);

    return waste;
  }

  if (Resolvers.isThirdSheet(params.consumptions, params.nextConsumptions)) {
    const waste = wasteForHeatingAndCooling({
      ...params,
      nextHdd: params.nextHdd.filter(isHdd),
      nextCdd: params.nextCdd.filter(isCdd),
    });
    return waste;
  }

  if (Resolvers.isSecondSheet(params.consumptions, params.nextConsumptions)) {
    const consumptions = await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), 'Heating');
    consumptions.push(...(await filterByIsOnUse(params.consumptions.filter(filterByYear(params.year - 1)), 'Cooling')));
    const nextConsumptions = await filterByIsOnUse(
      params.nextConsumptions.filter(filterByYear(params.year)),
      'Powering',
    );

    const p = {
      ...params,
      consumptions,
      nextConsumptions,
    };

    const waste = wasteForHeatingOrCoolingAndPower(p);
    return waste;
  }

  if (Resolvers.isFirstSheet(params.consumptions, params.nextConsumptions)) {
    const waste = wasteForSinglefuelFunction(params);
    return waste;
  }

  const waste = wasteForSinglefuelFunction(params);
  return waste;

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
