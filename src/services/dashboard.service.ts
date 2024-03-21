import { AppModels } from '@types';
import { Decimal } from 'decimal.js';
import { getDaysInMonth } from 'date-fns';
import { DbUtils, MathUtils } from '@utils';
import { DashboardService, SitesService, UtilityService } from '@services';
import formatISO from 'date-fns/formatISO';
import { FuelSource, GetConsumptionsParams } from './utility.service';
import { HDDRecord } from './greenDays.service';
import { filterByYearAndMonth } from '../utils/dbUtils';
import { ONE_OF_SUPPORTED_UNIT, resolveConsumptionToKwh } from '../utils/unitsUtils';

const uniqueElements = (a: any) => {
  const seen: Record<number, any> = {};
  const out = [];
  const len = a.length;
  let j = 0;
  for (let i = 0; i < len; i++) {
    const item = a[i];
    if (seen[item] !== 1) {
      seen[item] = 1;
      out[j++] = item;
    }
  }
  return out;
};

type ConsumptionForStatistic = Pick<
  AppModels['UtilityConsumption'],
  'date' | 'consumption' | 'totalCost' | 'conversionFactor' | 'siteId' | 'fuelSourceId' | 'fuelSourceName' | 'siteName'
>;
const getConsumptionStatistics = ({ consumptions }: { consumptions: ConsumptionForStatistic[] }) => {
  const filterByMonth = (monthToSearch: number) => (c: ConsumptionForStatistic) => {
    const [, month] = c.date.split('-');
    return new Decimal(month).equals(monthToSearch);
  };

  const getAverage = (record: ConsumptionForStatistic, of: 'totalCost' | 'consumption') => {
    const date = DbUtils.stringDateToDate(record.date);
    const amountOfDaysOnMonth = getDaysInMonth(date);
    return new Decimal(record[of]).dividedBy(amountOfDaysOnMonth).toDecimalPlaces(2).toNumber();
  };

  const sitesId = uniqueElements(consumptions.map((c) => c.siteId));
  const fuelSourcesId = uniqueElements(consumptions.map((c) => c.fuelSourceId));

  const consumptionStatistics = [];
  for (let siteIdx = 0; siteIdx < sitesId.length; siteIdx++) {
    let thisStatistics = [];
    for (let fuelSourcesIdx = 0; fuelSourcesIdx < fuelSourcesId.length; fuelSourcesIdx++) {
      thisStatistics = [];
      const fuelSourceId = fuelSourcesId[fuelSourcesIdx];
      const siteId = sitesId[siteIdx];

      const thisIterationConsumptions = consumptions
        .filter(UtilityService.filterByFuelSource(fuelSourceId))
        .filter(SitesService.filterBySiteId(siteId));

      for (let idx = 1; idx <= thisIterationConsumptions.length; idx++) {
        const consumptionFilter = (month: number) => (c: ConsumptionForStatistic) =>
          filterByMonth(month)(c) && c.fuelSourceId === fuelSourceId && siteId === c.siteId;

        const [consumptionOfMonth] = consumptions
          .filter(consumptionFilter(idx))
          .sort(DbUtils.sortByStringDate)
          .reverse();

        if (consumptionOfMonth === undefined) {
          break;
        }

        const date = `${consumptionOfMonth.date.split('-')[0]}-${('0' + idx).slice(-2)}-01`;
        const previouseRecord = consumptions
          .filter(consumptionFilter(idx - 1))
          .sort(DbUtils.sortByStringDate)
          .reverse()[0];

        const data = {
          date,
          fuelSourceId: fuelSourcesId[fuelSourcesIdx],
          fuelSourceName: consumptionOfMonth.fuelSourceName,
          siteId: sitesId[siteIdx],
          siteName: consumptionOfMonth.siteName,
          averageConsumption: getAverage(consumptionOfMonth, 'consumption'),
          averageCost: getAverage(consumptionOfMonth, 'totalCost'),
          cost: consumptionOfMonth.totalCost,
          consumption: consumptionOfMonth.consumption,
          increasedConsumptionPercentage:
            !previouseRecord || previouseRecord?.consumption === 0
              ? 0
              : MathUtils.calculateIncreasePercentage({
                  currentValue: consumptionOfMonth?.consumption || 0,
                  passValue: previouseRecord?.consumption,
                }),
          increasedCostPercentage:
            !previouseRecord || previouseRecord?.totalCost === 0
              ? 0
              : MathUtils.calculateIncreasePercentage({
                  currentValue: consumptionOfMonth?.totalCost || 0,
                  passValue: previouseRecord?.totalCost || 0,
                }),
        };
        thisStatistics.push(data);
      }
      consumptionStatistics.push(thisStatistics);
    }
  }
  return consumptionStatistics;
};

function groupBy<T>(list: T[], keyGetter: (i: T) => T[keyof T]) {
  const map = new Map<T[keyof T], T[]>();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return Array.from(map.entries());
}

const generateConsumptionDetail = ({
  consumptions: consumptionsArr,
}: {
  consumptions: Pick<
    AppModels['UtilityConsumption'],
    'date' | 'consumption' | 'totalCost' | 'fuelSourceName' | 'siteName'
  >[];
}) => {
  let consumptions = consumptionsArr;
  const consumptionDetails = [];
  if (consumptions.length === 1) {
    consumptions = consumptions.concat([]);
    const clone = { ...consumptions[0] };
    clone.consumption = 0;
    consumptions.unshift(clone);
  }
  for (let i = 1, len = consumptions.length; i < len; i++) {
    const previousRecord = consumptions[i - 1];
    const currentRecord = consumptions[i];
    consumptionDetails.push({
      date: currentRecord.date,
      siteName: currentRecord.siteName,
      fuelSourceName: currentRecord.fuelSourceName,
      consumption: currentRecord.consumption,
      incesedPercentage: previousRecord.consumption
        ? MathUtils.calculateIncreasePercentage({
            passValue: previousRecord.consumption,
            currentValue: currentRecord.consumption,
          })
        : 0,
    });
  }
  return consumptionDetails;
};

const getConsumptionDetails = ({
  consumptions,
}: {
  consumptions: Pick<
    AppModels['UtilityConsumption'],
    'date' | 'consumption' | 'totalCost' | 'fuelSourceName' | 'siteName'
  >[];
}) => {
  const consumptionDetails = [];
  const reducedConsumptions = groupBy(consumptions, (item) => item.fuelSourceName);

  for (let a = 0, len = reducedConsumptions.length; a < len; a++) {
    const consumptionsForFuel = reducedConsumptions[a][1];

    const r = generateConsumptionDetail({ consumptions: consumptionsForFuel });
    consumptionDetails.push(r);
  }

  return consumptionDetails.flat();
};

const generateMockConsumption = (p: { date: string; siteId: number; fuelSourceId: number }) => {
  return {
    date: p.date,
    consumption: 0,
    usedInId: [],
    cost: 0,
    vat: 0,
    conversionFactor: 0,
    fuelUnit: 'm3',
    totalCost: 0,
    siteId: p.siteId,
    siteName: '',
    id: 0,
    fuelSourceName: '',
    fuelSourceId: p.fuelSourceId,
    produced: true,
    conversionUnit: 'm3' as const,
  };
};
type ProduceYearConsumptionsParams = {
  startDate: Date;
  endDate: Date;
  businessId: number;
  fuelSourceId?: GetConsumptionsParams['fuelSourceId'];
  siteId: GetConsumptionsParams['siteId'];
};

type ProduceYearConsumptionsOptions = {
  fillStartOnly: boolean;
};

export type ProducedConsumption = AppModels['UtilityConsumption'] & { produced?: boolean };
const makeMapKey = (date: string, fuelSourceId: number, siteId: number) => {
  return `${date}-${fuelSourceId}-${siteId}`;
};
const produceYearConsumptions = async (
  p: ProduceYearConsumptionsParams,
  opt?: ProduceYearConsumptionsOptions,
): Promise<Array<ProducedConsumption>> => {
  const consumptionParams = {
    businessId: p.businessId,
    startDate: p.startDate,
    endDate: p.endDate,
    fuelSourceId: p.fuelSourceId,
    siteId: p.siteId,
  };

  const consumption = await UtilityService.getConsumptions(consumptionParams);
  const consumptionMap = new Map<string, typeof consumption[0]>();

  for (let i = 0; i < consumption.length; i++) {
    const item = consumption[i];
    consumptionMap.set(makeMapKey(item.date, item.fuelSourceId, item.siteId), item);
  }
  const lastDate = consumption.map((c) => c.date).sort((a, b) => b.localeCompare(a))[0];
  const sitesId = Array.from(new Set(consumption.map((c) => c.siteId)));
  const fuelSourcesId = Array.from(new Set(consumption.map((c) => c.fuelSourceId)));

  monthLoop: for (let idx = 0; idx <= 11; idx++) {
    const month = idx + 1;
    for (let siteIdx = 0; siteIdx < sitesId.length; siteIdx++) {
      for (let fuelIdx = 0; fuelIdx < fuelSourcesId.length; fuelIdx++) {
        const date = `${p.endDate.getFullYear()}-${month < 10 ? `0${month}` : month}-01`;
        const siteId = sitesId[siteIdx];
        const fuelSourceId = fuelSourcesId[fuelIdx];
        const key = makeMapKey(date, fuelSourceId, siteId);

        const iterateConsumption = consumptionMap.get(key);
        if (!iterateConsumption) {
          if (opt?.fillStartOnly === true) {
            if (DbUtils.stringDateToDate(date).getMonth() > DbUtils.stringDateToDate(lastDate).getMonth()) {
              break monthLoop;
            } else {
              consumptionMap.set(key, generateMockConsumption({ date, siteId, fuelSourceId }));
            }
          } else {
            consumptionMap.set(key, generateMockConsumption({ date, siteId, fuelSourceId }));
          }
        }
      }
    }
  }

  const records = Array.from(consumptionMap.values()).sort(DbUtils.sortByStringDate);
  return records;
};

const consumptionIsProduced = (i: any) => {
  return i.produced && i.produced === true;
};
const consumptionIsNotProduced = (i: any) => {
  return i.produced === undefined || i.produced === false;
};

export type CarbonEmission = {
  date: string;
  carbonEmission: number;
  fuelSourceId: number;
  carbonTarget: number;
  increasedConsumptionPercentage: number;
  averageEmissionPerDay: number;
  siteId: number;
  fuelUnit: string;
  conversionFactor: number;
};
const findCarbonEmissions = (
  params: {
    forYear?: Date;
    allConsumptions: AppModels['UtilityConsumption'][];
    emissions: AppModels['UtilityEmission'][];
    fuels?: FuelSource[];
  },
  opt?: { ignoreFuelSource: boolean },
) => {
  const filterResultForParamDate = (c: CarbonEmission) => {
    const yearParam = params.forYear;

    if (!yearParam) return true;

    const stringYearDate = formatISO(yearParam).split('T')[0];
    const year = stringYearDate.slice(0, 4);
    const dateToFilterBy = `${year}`;
    return c.date.slice(0, 4) === dateToFilterBy;
  };
  const findEmissionForConsumption = (c: AppModels['UtilityConsumption']) => (e: AppModels['UtilityEmission']) => {
    if (opt?.ignoreFuelSource === true) {
      const match = c.date.slice(0, 4) === e.date?.slice(0, 4) && c.siteId === e.siteId;
      return match;
    }
    return (
      c.date.slice(0, 4) === e.date?.split('-')[0].toString() &&
      c.fuelSourceId === e.fuelSourceId &&
      c.siteId === e.siteId
    );
  };

  const filterCarbonEmissionsForDate = (c: CarbonEmission) => (e: CarbonEmission) => {
    return c.date.slice(5, 7) === e.date.slice(5, 7);
  };

  const getCarbonEmissionsAverage = (carbonEmissions: CarbonEmission[]) => {
    let total = 0;
    for (let i = 0, len = carbonEmissions.length; i < len; i++) {
      const el = carbonEmissions[i];
      total = total + el.carbonEmission;
    }

    return new Decimal(total).dividedBy(carbonEmissions.length).toNumber();
  };

  const mapCarbonTarget = (carbon: CarbonEmission, idx: number, arr: CarbonEmission[]) => {
    const c = carbon;
    const previouseRecord = arr[idx - 1];
    const emissionsForThisItem = carbonEmissions.filter(filterCarbonEmissionsForDate(c));
    c.carbonTarget = getCarbonEmissionsAverage(emissionsForThisItem);
    c.increasedConsumptionPercentage = MathUtils.calculateIncreasePercentage({
      currentValue: c.carbonEmission,
      passValue: previouseRecord ? previouseRecord.carbonEmission : 0,
    });
    const monthAverage = new Decimal(c.carbonEmission)
      .dividedBy(getDaysInMonth(DbUtils.stringDateToDate(c.date)))
      .toDecimalPlaces(2)
      .toNumber();
    c.averageEmissionPerDay = monthAverage;
    return c;
  };

  const allCarbonEmissions = params.allConsumptions.map<CarbonEmission | null>((p) => {
    const currentEmission = params.emissions.find(findEmissionForConsumption(p));
    if (!currentEmission) return null;

    return {
      siteId: p.siteId,
      date: p.date,
      fuelUnit: p.fuelUnit,
      conversionFactor: p.conversionFactor,
      siteName: p.siteName,
      fuelSourceId: p.fuelSourceId,
      fuelSourceName: p.fuelSourceName,
      fuelSourceColorCode: params.fuels?.find((i) => i.id === p.fuelSourceId)?.colorCode || '#4989C6',
      carbonEmission: resolveConsumptionToKwh({
        consumption: p.consumption,
        fuelUnit: p.fuelUnit as ONE_OF_SUPPORTED_UNIT,
        conversionFactor: p.conversionFactor,
      }),
      cost: p.totalCost,
      carbonTarget: 0,
      increasedConsumptionPercentage: 0,
      averageEmissionPerDay: 0,
    };
  });

  const filterNull = (i: CarbonEmission | null) => i !== null;
  const carbonEmissions = allCarbonEmissions.filter(filterNull) as CarbonEmission[];

  const result = carbonEmissions.map(mapCarbonTarget).filter(filterResultForParamDate);

  return result;
};

const wasteForSinglefuelFunction = (params: {
  consumptions: ProducedConsumption[];
  hdd: HDDRecord[];
  nextConsumptions: AppModels['UtilityConsumption'][];
  nextHdd: HDDRecord[];
  year: number;
}) => {
  const results: (WasteValue & { projectedEnergy: number })[] = [];
  const fuelSources = Array.from(new Set(params.consumptions.map((i) => i.fuelSourceId)).values());
  for (let i = 0; i < fuelSources.length; i++) {
    const currentFuelSourceId = fuelSources[i];
    const currentFuelSourceConsumption = params.consumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year - 1));
    const totalOfConsumption = currentFuelSourceConsumption.reduce(
      (total, next) => new Decimal(total).add(next.consumption).toNumber(),
      0,
    );
    const totalOfHdd = params.hdd.reduce((total, next) => new Decimal(total).add(next.value).toNumber(), 0);
    let totalOfHddTimesConsumption = 0;
    for (let i = 0; i < params.hdd.length; i++) {
      const hdd = params.hdd[i];
      const consumption = currentFuelSourceConsumption.find(
        (c) => c.siteId === hdd.siteId && c.date === DbUtils.dateToStringDate(hdd.date),
      );
      if (!consumption) {
        continue;
      }
      totalOfHddTimesConsumption = new Decimal(totalOfHddTimesConsumption)
        .add(new Decimal(hdd.value).times(consumption.consumption))
        .toNumber();
    }
    const sumOfHddConsumptionTotal = new Decimal(totalOfConsumption).add(totalOfHdd).toNumber();
    const totalPowerOfConsumption = currentFuelSourceConsumption.reduce(
      (total, next) => new Decimal(total).add(new Decimal(next.consumption).pow(2)).toNumber(),
      0,
    );
    const totalPowerOfHdd = params.hdd.reduce(
      (total, next) => new Decimal(total).add(new Decimal(next.value).pow(2)).toNumber(),
      0,
    );

    const NX = 6 as const;

    const b9Top = new Decimal(new Decimal(NX).times(totalOfHddTimesConsumption))
      .minus(new Decimal(totalOfHdd).times(totalOfConsumption))
      .toNumber();
    const bBelow = new Decimal(new Decimal(NX).times(totalPowerOfHdd))
      .minus(new Decimal(totalOfHdd).times(totalOfHdd))
      .toNumber();
    const bSlope = new Decimal(b9Top).div(bBelow).toDP(8).toNumber();

    const aTop = new Decimal(new Decimal(totalOfConsumption).times(totalPowerOfHdd))
      .minus(new Decimal(totalOfHdd).times(totalOfHddTimesConsumption))
      .toNumber();
    const aBelow = new Decimal(new Decimal(NX).times(totalPowerOfHdd))
      .minus(new Decimal(totalOfHdd).times(totalOfHdd))
      .toNumber();
    const cIntercept = new Decimal(aTop).div(aBelow).toDP(8).toNumber();

    const currentFuelSourceNextConsumption = params.nextConsumptions
      .filter(UtilityService.filterByFuelSource(currentFuelSourceId))
      .filter(DbUtils.filterByYear(params.year));
    for (let i = 0; i < currentFuelSourceNextConsumption.length; i++) {
      const consumption = currentFuelSourceNextConsumption[i];
      if (DashboardService.consumptionIsProduced(consumption)) {
        continue;
      }
      const hdd = params.nextHdd.find(
        (h) => h.siteId === consumption.siteId && consumption.date === DbUtils.dateToStringDate(h.date),
      );
      if (!hdd) {
        continue;
      }
      const weather = new Decimal(hdd.value).times(bSlope);
      const projectedEnergy = new Decimal(cIntercept).add(weather).toNumber();
      const waste = new Decimal(projectedEnergy).minus(consumption.consumption).toDP(4, Decimal.ROUND_DOWN).toNumber();

      results.push({
        waste,
        siteId: consumption.siteId,
        date: consumption.date,
        projectedEnergy,
        fuelSourceId: consumption.fuelSourceId,
      });
    }
  }
  return results;
};

type KeysWithValsOfType<T, V> = keyof { [P in keyof T as T[P] extends V ? P : never]: P };
const populateByDateFromSite = (
  propertyVal: KeysWithValsOfType<AppModels['Site'], number>,
  p: { consumptions: AppModels['UtilityConsumption'][]; sites: AppModels['Site'][] },
): ValueByRecord[] => {
  const uniqueSites = Array.from(new Map(p.sites.map((s) => [s.id, s])).values());
  const uniqueDates = Array.from(new Set(p.consumptions.map((c) => c.date)).values());
  const filledArr: ValueByRecord[] = [];
  for (let i = 0; i < uniqueSites.length; i++) {
    const site = uniqueSites[i];
    for (let j = 0; j < uniqueDates.length; j++) {
      const date = uniqueDates[j];
      filledArr.push({
        siteId: site.id as number,
        date,
        value: site[propertyVal],
      });
    }
  }
  return filledArr;
};
const populateArrayByDateSite = (
  populateVal: number,
  p: { consumptions: AppModels['UtilityConsumption'][] },
): ValueByRecord[] => {
  const uniqueSites = Array.from(new Set(p.consumptions.map((c) => c.siteId)).values());
  const uniqueDates = Array.from(new Set(p.consumptions.map((c) => c.date)).values());
  const filledArr: ValueByRecord[] = [];
  for (let i = 0; i < uniqueSites.length; i++) {
    const siteId = uniqueSites[i];
    for (let j = 0; j < uniqueDates.length; j++) {
      const date = uniqueDates[j];
      filledArr.push({
        siteId,
        date,
        value: populateVal,
      });
    }
  }
  return filledArr;
};
type WasteValue = { waste: number; date: string; siteId: number; fuelSourceId: number };
type EnergyWasteParams = {
  consumptions: ProducedConsumption[];
  hdd: HDDRecord[];
  nextConsumptions: AppModels['UtilityConsumption'][];
  nextHdd: HDDRecord[];
  year: number;
};
const calculateWaste = async (params: EnergyWasteParams): Promise<WasteValue[]> => {
  const sites = await SitesService.findBy({
    id: params.consumptions.concat(params.nextConsumptions).map((s) => s.siteId),
  });

  const isLightingPowerAndCoolingFn = async (c: AppModels['UtilityConsumption']) => {
    const isLighting = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Lighting' });
    const isPower = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Powering' });
    const isCooling = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Cooling' });
    const isHeating = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Heating' });
    return isLighting && isPower && (isCooling || isHeating);
  };
  let promises = await Promise.all(
    params.consumptions.filter(DashboardService.consumptionIsNotProduced).map(isLightingPowerAndCoolingFn),
  );
  const isPowerAndLightingAndCooling = promises.some((i) => i === true);
  if (isPowerAndLightingAndCooling) {
    const records = wasteForPowerAndLightingAndCooling({
      baselineConsumptions: params.consumptions,
      projectedConsumptions: params.nextConsumptions,
      baselineDaylight: populateArrayByDateSite(16, { consumptions: params.consumptions }),
      projectedDaylight: populateArrayByDateSite(18, { consumptions: params.nextConsumptions }),
      baselinePopulation: populateByDateFromSite('population', { consumptions: params.consumptions, sites }),
      projectedPopulation: populateByDateFromSite('population', { consumptions: params.nextConsumptions, sites }),

      baselineTime: populateByDateFromSite('workinghours', { consumptions: params.consumptions, sites }),
      projectedTime: populateByDateFromSite('workinghours', { consumptions: params.nextConsumptions, sites }),

      ...params,
    });
    return records;
  }

  const isPowerAndLightingFn = async (c: AppModels['UtilityConsumption']) => {
    const isLighting = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Lighting' });
    const isPower = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Powering' });
    return isLighting && isPower;
  };
  promises = await Promise.all(
    params.consumptions.filter(DashboardService.consumptionIsNotProduced).map(isPowerAndLightingFn),
  );
  const isPowerAndLighting = promises.some((i) => i === true);
  if (isPowerAndLighting) {
    const records = wasteForPowerAndLighting({
      baselineConsumptions: params.consumptions,
      projectedConsumptions: params.nextConsumptions,
      baselineDaylight: populateArrayByDateSite(16, { consumptions: params.consumptions }),
      projectedDaylight: populateArrayByDateSite(18, { consumptions: params.nextConsumptions }),
      baselinePopulation: populateByDateFromSite('population', { consumptions: params.consumptions, sites }),
      projectedPopulation: populateByDateFromSite('population', { consumptions: params.nextConsumptions, sites }),

      baselineTime: populateByDateFromSite('workinghours', { consumptions: params.consumptions, sites }),
      projectedTime: populateByDateFromSite('workinghours', { consumptions: params.nextConsumptions, sites }),
    });
    return records;
  }

  const isHeatingOrCoolingFn = async (c: AppModels['UtilityConsumption']) => {
    const heating = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Heating' });
    const cooling = await UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Cooling' });
    return heating || cooling;
  };

  promises = await Promise.all(
    params.consumptions.filter(DashboardService.consumptionIsNotProduced).map(isHeatingOrCoolingFn),
  );
  const isSingleUse = promises.some((i) => i === true);
  if (isSingleUse) {
    const records = wasteForSinglefuelFunction(params);
    return records;
  }

  return [];
};

type ValueByRecord = {
  siteId: number;
  value: number;
  date: string;
};
type WasteForPowerAndLightingParams = {
  baselineConsumptions: AppModels['UtilityConsumption'][];
  projectedConsumptions: AppModels['UtilityConsumption'][];

  //16 for all items on array
  baselineDaylight: ValueByRecord[];
  //18 for all items on array
  projectedDaylight: ValueByRecord[];

  //use site population for all months
  baselinePopulation: ValueByRecord[];
  projectedPopulation: ValueByRecord[];

  //use site FTP hours for all months
  baselineTime: ValueByRecord[];
  projectedTime: ValueByRecord[];
};
const wasteForPowerAndLighting = (p: WasteForPowerAndLightingParams) => {
  const ecChangePercentageChange = p.projectedConsumptions.map((c, idx) => {
    const baselineConsumption = p.baselineConsumptions[idx];
    const baselineVal = baselineConsumption ? baselineConsumption.consumption : 0;
    return new Decimal(new Decimal(c.consumption).minus(baselineVal).div(baselineVal)).times(100).toDP(8);
  });

  const daylightPercentageChange: ValueByRecord[] = [];
  for (let i = 0; i < p.baselineDaylight.length; i++) {
    const item = p.baselineDaylight[i];
    const [projectedValue] = p.projectedDaylight
      .filter(SitesService.filterBySiteId(item.siteId))
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(item, 1) }));
    const value = new Decimal(new Decimal(projectedValue.value).minus(item.value).div(100))
      .times(100)
      .toDP(9)
      .toNumber();

    daylightPercentageChange.push({
      value,
      siteId: item.siteId,
      date: item.date,
    });
  }

  const baselinePopulationMultipliedByTime: ValueByRecord[] = [];
  for (let i = 0; i < p.baselineTime.length; i++) {
    const item = p.baselineTime[i];
    const [baselinePopulation] = p.baselinePopulation.filter(DbUtils.filterByYearAndMonth(item));

    if (!baselinePopulation) {
      continue;
    }

    baselinePopulationMultipliedByTime.push({
      value: new Decimal(item.value).times(baselinePopulation.value).toDP(9).toNumber(),
      siteId: item.siteId,
      date: item.date,
    });
  }
  const projectedPopulationMultipliedByTime: ValueByRecord[] = []; // projected PT
  for (let i = 0; i < p.projectedPopulation.length; i++) {
    const item = p.projectedPopulation[i];
    const [projectedTime] = p.projectedTime
      .filter(SitesService.filterBySiteId(item.siteId))
      .filter(DbUtils.filterByYearAndMonth(item));
    if (!projectedTime) {
      continue;
    }
    projectedPopulationMultipliedByTime.push({
      value: new Decimal(item.value).times(projectedTime.value).toDP(9).toNumber(),
      siteId: item.siteId,
      date: item.date,
    });
  }

  const projectedPopulationMultipliedByTimePercentageChange = baselinePopulationMultipliedByTime.map((_) => {
    const [projectedByTime] = projectedPopulationMultipliedByTime
      .filter(SitesService.filterBySiteId(_.siteId))
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(_, 1) }));
    const [baselineValue] = baselinePopulationMultipliedByTime
      .filter(SitesService.filterBySiteId(_.siteId))
      .filter(DbUtils.filterByYearAndMonth(_));
    return {
      value: new Decimal(new Decimal(projectedByTime.value).minus(baselineValue.value).div(baselineValue.value))
        .times(100)
        .toDP(9),
      siteId: baselineValue.siteId,
      date: baselineValue.date,
    };
  });

  const percentageTotalVariable = projectedPopulationMultipliedByTimePercentageChange.map((_) => {
    const [daylightValue] = daylightPercentageChange
      .filter(SitesService.filterBySiteId(_.siteId))
      .filter(DbUtils.filterByYearAndMonth(_));
    return {
      value: new Decimal(_.value).add(daylightValue.value).toDP(8).toNumber(),
      siteId: _.siteId,
      date: daylightValue.date,
    };
  });

  const records: (WasteValue & { percentageVariable: number })[] = [];

  for (let i = 0; i < p.projectedConsumptions.filter(DashboardService.consumptionIsNotProduced).length; i++) {
    const record = p.projectedConsumptions[i];

    const [currentBaselineConsumption] = p.baselineConsumptions
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(record, 1) }))
      //TODO: check and handle case for records with same differents fuelSourceId
      .filter(SitesService.filterBySiteId(record.siteId));
    if (!currentBaselineConsumption) {
      continue;
    }
    const [projectedConsumption] = p.projectedConsumptions
      .filter(DbUtils.filterByYearAndMonth(record))
      .filter(SitesService.filterBySiteId(record.siteId));
    if (!projectedConsumption) {
      continue;
    }
    const [percentageVariable] = percentageTotalVariable
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(record, 1) }))
      .filter(SitesService.filterBySiteId(record.siteId));
    const waste = new Decimal(
      new Decimal(new Decimal(percentageVariable.value).div(100)).times(currentBaselineConsumption.consumption),
    )
      .add(currentBaselineConsumption.consumption)
      .minus(projectedConsumption.consumption)
      .toDP(8)
      .toNumber();

    records.push({
      waste,
      siteId: record.siteId,
      date: record.date,
      percentageVariable: percentageVariable.value,
      fuelSourceId: record.fuelSourceId,
    });
  }
  return records;
};

const wasteForPowerAndLightingAndCooling = (p: WasteForPowerAndLightingParams & EnergyWasteParams) => {
  const powerAndLighting = wasteForPowerAndLighting(p);
  const oneEnergy = wasteForSinglefuelFunction(p);

  const records: WasteValue[] = [];
  for (let i = 0; i < p.nextConsumptions.length; i++) {
    const record = p.nextConsumptions[i];
    const [singlePowerAndLighting] = powerAndLighting
      .filter(SitesService.filterBySiteId(record.siteId))
      .filter(DbUtils.filterByYearAndMonth(record));
    if (!singlePowerAndLighting) {
      continue;
    }

    const [singleProjectedEnergy] = oneEnergy
      .filter(SitesService.filterBySiteId(record.siteId))
      .filter(DbUtils.filterByYearAndMonth(record));
    if (!singleProjectedEnergy) {
      continue;
    }

    const ajustedProjectedEnergy = new Decimal(new Decimal(singlePowerAndLighting.percentageVariable).div(100))
      .times(singleProjectedEnergy.projectedEnergy)
      .toDP(8, Decimal.ROUND_HALF_UP);

    records.push({
      waste: new Decimal(new Decimal(ajustedProjectedEnergy).add(singleProjectedEnergy.projectedEnergy))
        .minus(record.consumption)
        .toDP(8)
        .toNumber(),
      siteId: singleProjectedEnergy.siteId,
      date: singleProjectedEnergy.date,
      fuelSourceId: singleProjectedEnergy.fuelSourceId,
    });
  }
  return records;
};

const calculateFinancialCost = (p: {
  consumptions: AppModels['UtilityConsumption'][];
  waste: Awaited<ReturnType<typeof calculateWaste>>;
}) => {
  const records = [];
  for (let i = 0; i < p.consumptions.length; i++) {
    const consumption = p.consumptions[i];
    const [waste] = p.waste
      .filter(filterByYearAndMonth(consumption))
      .filter(SitesService.filterBySiteId(consumption.siteId));
    if (!waste) {
      continue;
    }
    records.push({
      financialCost: new Decimal(waste.waste)
        .times(new Decimal(consumption.totalCost).div(consumption.consumption))
        .toDP(8)
        .toNumber(),
      siteId: consumption.siteId,
      date: consumption.date,
      fuelSourceId: consumption.fuelSourceId,
    });
  }
  return records;
};

const calculateCarbonImpact = (p: {
  consumptions: AppModels['UtilityConsumption'][];
  emissions: Awaited<ReturnType<typeof UtilityService.getEmissions>>;
  waste: Awaited<ReturnType<typeof calculateWaste>>;
}) => {
  const records = [];
  for (let i = 0; i < p.consumptions.length; i++) {
    const consumption = p.consumptions[i];
    const [emission] = p.emissions
      .filter(filterByYearAndMonth(consumption))
      .filter(SitesService.filterBySiteId(consumption.siteId))
      .filter(UtilityService.filterByFuelSource(consumption.fuelSourceId));
    if (!emission) {
      continue;
    }

    const [waste] = p.waste
      .filter(filterByYearAndMonth(consumption))
      .filter(SitesService.filterBySiteId(consumption.siteId))
      .filter(UtilityService.filterByFuelSource(consumption.fuelSourceId));
    if (!waste) {
      continue;
    }
    records.push({
      date: consumption.date,
      siteId: consumption.siteId,
      fuelSourceId: consumption.fuelSourceId,
      usedInId: consumption.usedInId,
      consumption: consumption.consumption,
      consumptionCarbonImpact: new Decimal(consumption.consumption).times(emission.emissionFactor).toDP(8).toNumber(),
      consumptionFinancialCost: new Decimal(new Decimal(consumption.totalCost).div(consumption.consumption))
        .times(consumption.consumption)
        .toDP(8)
        .toNumber(),
      wasteCarbonImpact: new Decimal(waste.waste).times(emission.emissionFactor).toDP(8).toNumber(),
      wasteFinancialCost: new Decimal(new Decimal(consumption.totalCost).div(consumption.consumption))
        .times(waste.waste)
        .toDP(8)
        .toNumber(),
    });
  }
  return records;
};

export default {
  getConsumptionStatistics,
  getConsumptionDetails,
  produceYearConsumptions,
  consumptionIsProduced,
  consumptionIsNotProduced,
  findCarbonEmissions,
  calculateWaste,
  wasteForPowerAndLighting,
  wasteForSinglefuelFunction,
  wasteForPowerAndLightingAndCooling,
  calculateFinancialCost,
  calculateCarbonImpact,
};
