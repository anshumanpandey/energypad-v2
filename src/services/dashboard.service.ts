import { AppModels } from '@types';
import { Decimal } from 'decimal.js';
import { getDaysInMonth, setMonth, subMonths } from 'date-fns';
import { DbUtils, MathUtils } from '@utils';
import { DashboardService, SitesService, UtilityService } from '@services';
import formatISO from 'date-fns/formatISO';
import { FuelSource, GetConsumptionsParams, SupportedUses } from './utility.service';
import { HDDRecord } from './greenDays.service';
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
const getConsumptionStatistics = ({ consumptions, year }: { consumptions: ConsumptionForStatistic[]; year: Date }) => {
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

      for (let idx = 0; idx <= thisIterationConsumptions.length; idx++) {
        const date = setMonth(year, idx);
        const consumptionFilter = (d: { date: Date }) => (c: ConsumptionForStatistic) =>
          DbUtils.filterByYearAndMonth({ date: DbUtils.dateToStringDate(d.date) })(c) &&
          c.fuelSourceId === fuelSourceId &&
          siteId === c.siteId;

        const [consumptionOfMonth] = consumptions
          .filter(consumptionFilter({ date }))
          .sort(DbUtils.sortByStringDate)
          .reverse();

        if (consumptionOfMonth === undefined) {
          break;
        }

        const [previouseRecord] = consumptions
          .filter(consumptionFilter({ date: subMonths(date, 1) }))
          .sort(DbUtils.sortByStringDate)
          .reverse();

        const data = {
          date: DbUtils.dateToStringDate(date),
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

const generateConsumptionDetail = ({
  consumptions,
  year,
}: {
  consumptions: Pick<
    AppModels['UtilityConsumption'],
    'date' | 'consumption' | 'totalCost' | 'fuelSourceName' | 'siteName' | 'siteId' | 'fuelSourceId'
  >[];
  year: Date;
}) => {
  const consumptionDetails = [];
  const thisYearConsumptions = consumptions.filter(DbUtils.filterByYear(year.getFullYear()));
  for (let i = 0, len = thisYearConsumptions.length; i < len; i++) {
    const currentRecord = thisYearConsumptions[i];
    const [previousRecord] = consumptions
      .filter(SitesService.filterBySiteId(currentRecord.siteId))
      .filter(UtilityService.filterByFuelSource(currentRecord.fuelSourceId))
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseMonth(currentRecord, 1) }));
    const record = {
      date: currentRecord.date,
      siteName: currentRecord.siteName,
      fuelSourceName: currentRecord.fuelSourceName,
      consumption: currentRecord.consumption,
      incesedPercentage:
        previousRecord?.consumption !== undefined
          ? MathUtils.calculateIncreasePercentage({
              passValue: previousRecord.consumption,
              currentValue: currentRecord.consumption,
            })
          : 0,
    };
    if (DbUtils.stringDateToDate(record.date).getFullYear() === year.getFullYear()) {
      consumptionDetails.push(record);
    }
  }
  return consumptionDetails;
};

const getConsumptionDetails = (p: {
  consumptions: Pick<
    AppModels['UtilityConsumption'],
    'date' | 'consumption' | 'totalCost' | 'fuelSourceName' | 'siteName' | 'fuelSourceId' | 'siteId'
  >[];
  year: Date;
}) => {
  const consumptionDetails = generateConsumptionDetail(p);

  return consumptionDetails.flat();
};

const generateMockConsumption = (p: { date: string; siteId: number; fuelSourceId: number }) => {
  return {
    date: p.date,
    consumption: 0,
    usedInId: 0,
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
const makeMapKey = (date: string, fuelSourceId: number, siteId: number, usedInId: number) => {
  return `${date}-${fuelSourceId}-${siteId}-${usedInId}`;
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
    consumptionMap.set(makeMapKey(item.date, item.fuelSourceId, item.siteId, item.usedInId), item);
  }
  const lastDate = consumption.map((c) => c.date).sort((a, b) => b.localeCompare(a))[0];
  const sitesId = Array.from(new Set(consumption.map((c) => c.siteId)));
  const fuelSourcesId = Array.from(new Set(consumption.map((c) => c.fuelSourceId)));
  const usedInsId = Array.from(new Set(consumption.map((c) => c.usedInId)));

  monthLoop: for (let idx = 0; idx <= 11; idx++) {
    const month = idx + 1;
    for (let siteIdx = 0; siteIdx < sitesId.length; siteIdx++) {
      for (let fuelIdx = 0; fuelIdx < fuelSourcesId.length; fuelIdx++) {
        for (let usedInIdIdx = 0; usedInIdIdx < usedInsId.length; usedInIdIdx++) {
          const date = `${p.endDate.getFullYear()}-${month < 10 ? `0${month}` : month}-01`;
          const siteId = sitesId[siteIdx];
          const fuelSourceId = fuelSourcesId[fuelIdx];
          const usedInId = usedInsId[usedInIdIdx];
          const key = makeMapKey(date, fuelSourceId, siteId, usedInId);

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

const wasteCost = (p: { consumption: AppModels['UtilityConsumption']; waste: number }) => {
  return new Decimal(new Decimal(p.consumption.totalCost).div(p.consumption.consumption))
    .times(p.waste)
    .toDP(2)
    .absoluteValue()
    .toNumber();
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
    monitoring: AppModels['ConsumptionTarget'][];
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

  const mapCarbonTarget = (carbon: CarbonEmission, idx: number, arr: CarbonEmission[]) => {
    const c = carbon;
    const previouseRecord = arr[idx - 1];
    const [targetForThisItem] = params.monitoring
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.stringDateToDate(c.date) }))
      .filter(UtilityService.filterByFuelSource(c.fuelSourceId));
    c.carbonTarget = targetForThisItem.carbon;
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
        consumption: new Decimal(currentEmission.emissionFactor).times(p.consumption).toDP(2).toNumber(),
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
  const results: (WasteValue & { projectedEnergy: number; cIntercept: number })[] = [];
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
    const totalPowerOfHdd = params.hdd.reduce(
      (total, next) => new Decimal(total).add(new Decimal(next.value).pow(2)).toNumber(),
      0,
    );
    const sumYX = currentFuelSourceConsumption.reduce((total, next, idx) => {
      const c = next;
      const hdd = params.hdd[idx];
      //TODO: fix hdd below
      return new Decimal(total).plus(new Decimal(c.consumption).times(hdd?.value || 1)).toNumber();
    }, 0);

    const NX = currentFuelSourceConsumption.length;

    const bSlope = new Decimal(new Decimal(NX).times(sumYX).minus(new Decimal(totalOfHdd).times(totalOfConsumption)))
      .div(new Decimal(new Decimal(NX).times(totalPowerOfHdd)).minus(new Decimal(totalOfHdd).pow(2)))
      .toDP(8)
      .toNumber();

    const aTop = new Decimal(new Decimal(totalOfConsumption).times(totalPowerOfHdd)).minus(
      new Decimal(totalOfHdd).times(totalOfHddTimesConsumption),
    );
    const aBelow = new Decimal(new Decimal(NX).times(totalPowerOfHdd)).minus(new Decimal(totalOfHdd).times(totalOfHdd));
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
        wasteCost: wasteCost({ consumption, waste }),
        date: consumption.date,
        consumption: consumption.consumption,
        projectedEnergy,
        fuelSourceId: consumption.fuelSourceId,
        siteId: consumption.siteId,
        fuelSourceName: consumption.fuelSourceName,
        siteName: consumption.siteName,
        cIntercept,
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
type WasteValue = {
  waste: number;
  date: string;
  siteId: number;
  fuelSourceId: number;
  siteName: string;
  fuelSourceName: string;
  wasteCost: number;
  consumption: number;
};
type EnergyWasteParams = {
  consumptions: ProducedConsumption[];
  hdd: HDDRecord[];
  nextConsumptions: AppModels['UtilityConsumption'][];
  nextHdd: HDDRecord[];
  year: number;

  singleFuelConsumptions: WasteForPowerAndLightingAndCoolingV2Params['singleFuelConsumptions'];
  singleFuelHdd: WasteForPowerAndLightingAndCoolingV2Params['singleFuelHdd'];

  singleFuelProjectedConsumptions: WasteForPowerAndLightingAndCoolingV2Params['singleFuelProjectedConsumptions'];
  singleFuelProjectedHdd: WasteForPowerAndLightingAndCoolingV2Params['singleFuelProjectedHdd'];

  lightingAndPowerConsumptions: WasteForPowerAndLightingAndCoolingV2Params['lightingAndPowerConsumptions'];
  lightingAndPowerProjectedConsumptions: WasteForPowerAndLightingAndCoolingV2Params['lightingAndPowerProjectedConsumptions'];

  selectedYearConsumptions: WasteForPowerAndLightingAndCoolingV2Params['selectedYearConsumptions'];
  selectedYearHdd: WasteForPowerAndLightingAndCoolingV2Params['selectedYearHdd'];
};
const calculateWaste = async (params: EnergyWasteParams): Promise<WasteValue[]> => {
  const records = wasteForSinglefuelFunction(params);
  return records;
};

type ValueByRecord = {
  siteId: number;
  value: number;
  date: string;
};
export type WasteForPowerAndLightingParams = {
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
    const consumption = p.projectedConsumptions[i];

    const [currentBaselineConsumption] = p.baselineConsumptions
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(consumption, 1) }))
      //TODO: check and handle case for records with same differents fuelSourceId
      .filter(SitesService.filterBySiteId(consumption.siteId));
    if (!currentBaselineConsumption) {
      continue;
    }
    const [projectedConsumption] = p.projectedConsumptions
      .filter(DbUtils.filterByYearAndMonth(consumption))
      .filter(SitesService.filterBySiteId(consumption.siteId));
    if (!projectedConsumption) {
      continue;
    }
    const [percentageVariable] = percentageTotalVariable
      .filter(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(consumption, 1) }))
      .filter(SitesService.filterBySiteId(consumption.siteId));
    const waste = new Decimal(
      new Decimal(new Decimal(percentageVariable.value).div(100)).times(currentBaselineConsumption.consumption),
    )
      .add(currentBaselineConsumption.consumption)
      .minus(projectedConsumption.consumption)
      .toDP(8)
      .toNumber();

    records.push({
      waste,
      wasteCost: wasteCost({ consumption, waste }),
      consumption: consumption.consumption,
      siteId: consumption.siteId,
      date: consumption.date,
      percentageVariable: percentageVariable.value,
      fuelSourceId: consumption.fuelSourceId,
      fuelSourceName: consumption.fuelSourceName,
      siteName: consumption.siteName,
    });
  }
  return records;
};

const wasteForPowerAndLightingAndCooling = (
  p: WasteForPowerAndLightingParams & EnergyWasteParams & { lightingPowerCoolingHdd: HDDRecord[] },
) => {
  const powerAndLighting = wasteForPowerAndLighting(p);
  const oneEnergy = wasteForSinglefuelFunction(p);

  const records: WasteValue[] = [];
  for (let i = 0; i < p.nextConsumptions.length; i++) {
    const consumption = p.nextConsumptions[i];
    const [singlePowerAndLighting] = powerAndLighting
      .filter(SitesService.filterBySiteId(consumption.siteId))
      .filter(DbUtils.filterByYearAndMonth(consumption));
    if (!singlePowerAndLighting) {
      continue;
    }

    const [singleProjectedEnergy] = oneEnergy
      .filter(SitesService.filterBySiteId(consumption.siteId))
      .filter(DbUtils.filterByYearAndMonth(consumption));
    if (!singleProjectedEnergy) {
      continue;
    }
    const hddToUse = p.lightingPowerCoolingHdd[i];
    if (!hddToUse) {
      continue;
    }

    const weather = new Decimal(hddToUse.value).times(p.projectedConsumptions[i].consumption);
    const projected = new Decimal(singleProjectedEnergy.cIntercept).add(weather);
    const adjustedProjectedEnergyPtdl = new Decimal(singlePowerAndLighting.percentageVariable)
      .div(100)
      .times(projected);

    const waste = new Decimal(new Decimal(adjustedProjectedEnergyPtdl).add(projected))
      .minus(consumption.consumption)
      .toDP(6, Decimal.ROUND_HALF_UP)
      .toNumber();

    records.push({
      waste,
      wasteCost: wasteCost({ consumption, waste }),
      consumption: consumption.consumption,
      siteId: singleProjectedEnergy.siteId,
      date: singleProjectedEnergy.date,
      fuelSourceId: singleProjectedEnergy.fuelSourceId,
      fuelSourceName: consumption.fuelSourceName,
      siteName: consumption.siteName,
    });
  }
  return records;
};

const filterLightingAndPowerConsumption = async (p: {
  yearToFilterBy: number;
  consumptions: AppModels['UtilityConsumption'][];
}) => {
  const validConsumptions: AppModels['UtilityConsumption'][] = [];
  const promises = [];

  for (let i = 0; i < p.consumptions.length; i++) {
    const c = p.consumptions[i];

    const f = async () => {
      const [isLighting, isPowering] = await Promise.all([
        UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Lighting' }),
        UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Powering' }),
      ]);
      const hasSelectedYear = c.date.split('-')[0] === p.yearToFilterBy.toString();
      if ((isLighting || isPowering) && hasSelectedYear) {
        validConsumptions.push(c);
      }
    };
    promises.push(f());
  }

  await Promise.all(promises);
  return validConsumptions;
};

const filterSingleConsumptionForHeatingOrCooling = async (p: {
  yearToFilterBy: number;
  consumptions: AppModels['UtilityConsumption'][];
}) => {
  const validConsumptions: AppModels['UtilityConsumption'][] = [];
  const promises = [];

  for (let i = 0; i < p.consumptions.length; i++) {
    const c = p.consumptions[i];

    const f = async () => {
      const [isHeating, isCooling] = await Promise.all([
        UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Heating' }),
        UtilityService.isOnUse({ usedInId: c.usedInId, use: 'Cooling' }),
      ]);
      const hasSelectedYear = c.date.split('-')[0] === p.yearToFilterBy.toString();

      if ((isHeating || isCooling) && hasSelectedYear) {
        validConsumptions.push(c);
      }
    };
    promises.push(f());
  }
  await Promise.all(promises);
  return validConsumptions;
};

export type WasteForPowerAndLightingAndCoolingV2Params = {
  singleFuelConsumptions: AppModels['UtilityConsumption'][];
  singleFuelHdd: HDDRecord[];

  singleFuelProjectedConsumptions: AppModels['UtilityConsumption'][];
  singleFuelProjectedHdd: HDDRecord[];

  lightingAndPowerConsumptions: AppModels['UtilityConsumption'][];
  lightingAndPowerProjectedConsumptions: AppModels['UtilityConsumption'][];
  baselineDaylight: WasteForPowerAndLightingParams['baselineDaylight'];
  projectedDaylight: WasteForPowerAndLightingParams['projectedDaylight'];
  baselinePopulation: WasteForPowerAndLightingParams['baselinePopulation'];
  projectedPopulation: WasteForPowerAndLightingParams['projectedPopulation'];
  baselineTime: WasteForPowerAndLightingParams['baselineTime'];
  projectedTime: WasteForPowerAndLightingParams['projectedTime'];

  selectedYearConsumptions: AppModels['UtilityConsumption'][];
  selectedYearHdd: HDDRecord[];
};
const wasteForPowerAndLightingAndCoolingV2 = (p: WasteForPowerAndLightingAndCoolingV2Params): WasteValue[] => {
  const sites = Array.from(new Set(p.selectedYearConsumptions.map((c) => c.siteId)).values());
  const lightingPowerDataChange: { date: string; changeProjectedData: number; siteId: number }[] = [];

  for (let s = 0; s < sites.length; s++) {
    const thisSite = sites[s];
    const consumptions = p.lightingAndPowerConsumptions.filter(SitesService.filterBySiteId(thisSite));
    consumptionsLoop: for (let c = 0; c < consumptions.length; c++) {
      const thisLightingAndPowerConsumptions = consumptions[c];
      const thisLightingAndPowerProjectedConsumptions = p.lightingAndPowerProjectedConsumptions
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(thisLightingAndPowerConsumptions, 1) }));
      if (!thisLightingAndPowerProjectedConsumptions) {
        continue consumptionsLoop;
      }
      const thisBaselinePopulation = p.baselinePopulation
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(thisLightingAndPowerConsumptions));
      const thisBaselineTime = p.baselineTime
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(thisLightingAndPowerConsumptions));
      const thisBaselineDaylight = p.baselineDaylight
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(thisLightingAndPowerConsumptions));
      const thisProjectedDaylight = p.projectedDaylight
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(thisLightingAndPowerConsumptions, 1) }));
      const thisProjectedPopulation = p.projectedPopulation
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(thisLightingAndPowerConsumptions, 1) }));
      const thisProjectedTime = p.projectedTime
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.increaseYear(thisLightingAndPowerConsumptions, 1) }));

      const ecChange = new Decimal(
        new Decimal(thisLightingAndPowerProjectedConsumptions.consumption)
          .minus(thisLightingAndPowerConsumptions.consumption)
          .div(thisLightingAndPowerConsumptions.consumption)
          .times(100),
      )
        .toDP(8)
        .toNumber();

      let daylightChange = undefined;
      if (thisBaselineDaylight && thisProjectedDaylight) {
        daylightChange = new Decimal(
          new Decimal(thisProjectedDaylight.value).minus(thisBaselineDaylight.value).div(100).times(100),
        )
          .toDP(8)
          .toNumber();
      }

      let baselinePopulationTimesTime = undefined;
      if (thisBaselinePopulation && thisBaselineTime) {
        baselinePopulationTimesTime = new Decimal(thisBaselinePopulation.value)
          .times(thisBaselineTime.value)
          .toDP(8)
          .toNumber();
      }

      let projectedPopulationTimesTime = undefined;
      if (thisProjectedPopulation && thisProjectedTime) {
        projectedPopulationTimesTime = new Decimal(thisProjectedPopulation.value)
          .times(thisProjectedTime.value)
          .toDP(8)
          .toNumber();
      }

      if (projectedPopulationTimesTime && baselinePopulationTimesTime && daylightChange) {
        const changeInPopulationAndTime = new Decimal(
          new Decimal(projectedPopulationTimesTime)
            .minus(baselinePopulationTimesTime)
            .div(baselinePopulationTimesTime)
            .times(100),
        )
          .toDP(8)
          .toNumber();
        const changeInProjectedPopulationAndTime = new Decimal(changeInPopulationAndTime)
          .add(daylightChange)
          .toDP(8)
          .toNumber();
        lightingPowerDataChange.push({
          date: thisLightingAndPowerProjectedConsumptions.date,
          changeProjectedData: changeInProjectedPopulationAndTime,
          siteId: thisSite,
        });
      }
    }
  }

  const overusedEnergyRecords: {
    date: string;
    overused: number;
    siteId: number;
    intercept: number;
  }[] = [];
  for (let s = 0; s < sites.length; s++) {
    const thisSite = sites[s];
    const thisNextYearConsumptions = p.singleFuelConsumptions.filter(SitesService.filterBySiteId(thisSite));
    if (thisNextYearConsumptions.length === 0) {
      continue;
    }
    const thisSingleFuelProjectedConsumptions = p.singleFuelProjectedConsumptions.filter(
      SitesService.filterBySiteId(thisSite),
    );
    const thisSinglefuelHdd = p.singleFuelHdd.filter(SitesService.filterBySiteId(thisSite));

    const NX = thisNextYearConsumptions.length;

    const totalOfNextYearConsumption = thisNextYearConsumptions.reduce(
      (total, next) => new Decimal(total).add(next.consumption).toNumber(),
      0,
    );

    const totalOfNextYearHdd = thisSinglefuelHdd.reduce(
      (total, next) => new Decimal(total).add(next.value).toNumber(),
      0,
    );

    const sumOfNextYearConsumptionAndHdd = thisNextYearConsumptions.reduce((total, next) => {
      const c = next;
      const hdd = thisSinglefuelHdd.find((h) => DbUtils.dateToStringDate(h.date) === c.date);
      if (!hdd) {
        return total;
      }
      return new Decimal(total).plus(new Decimal(c.consumption).times(hdd.value)).toNumber();
    }, 0);
    const totalOfNextYearHddPowerOfTwo = thisSinglefuelHdd.reduce(
      (total, next) => new Decimal(total).add(new Decimal(next.value).pow(2)).toNumber(),
      0,
    );

    const bSlope = new Decimal(
      new Decimal(NX)
        .times(sumOfNextYearConsumptionAndHdd)
        .minus(new Decimal(totalOfNextYearHdd).times(totalOfNextYearConsumption)),
    )
      .div(
        new Decimal(new Decimal(NX).times(totalOfNextYearHddPowerOfTwo)).minus(new Decimal(totalOfNextYearHdd).pow(2)),
      )
      .toDP(8)
      .toNumber();

    //(2392 - (((12×174622) - (2392×862)) / ((12×63170) - 743044)) * 862) / 12
    //(2392 - ((2095464 - 2061904) / (758040 - 743044)) * 862) / 12
    //(2392 - (33560 / 14996) * 862) / 12
    //(2392 - (2.23793011 * 862)) / 12
    //(2392 - 1929.09575) / 12
    //462.90425 / 12
    const leftSide = new Decimal(new Decimal(NX).times(sumOfNextYearConsumptionAndHdd)).minus(
      new Decimal(totalOfNextYearHdd).times(totalOfNextYearConsumption),
    );
    const rightSide = new Decimal(new Decimal(NX).times(totalOfNextYearHddPowerOfTwo)).minus(
      new Decimal(totalOfNextYearHdd).pow(2),
    );
    const intercept = new Decimal(
      new Decimal(
        new Decimal(totalOfNextYearConsumption).minus(
          new Decimal(new Decimal(leftSide).div(rightSide)).times(totalOfNextYearHdd),
        ),
      ).div(NX),
    )
      .toDP(8)
      .toNumber();

    secondYearLoop: for (let a = 0; a < thisSingleFuelProjectedConsumptions.length; a++) {
      const thisSingleFuelProjectedConsumption = thisSingleFuelProjectedConsumptions[a];
      const thisSingleFuelProjectedHdd = p.singleFuelProjectedHdd
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(thisSingleFuelProjectedConsumption));

      if (!thisSingleFuelProjectedHdd || !thisSingleFuelProjectedConsumption) {
        continue secondYearLoop;
      }

      const thisChangeProjectedData = lightingPowerDataChange
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(thisSingleFuelProjectedConsumption));
      if (thisChangeProjectedData) {
        const baseload = intercept;
        const wheater = new Decimal(bSlope).times(thisSingleFuelProjectedHdd.value);
        const projected = new Decimal(baseload).plus(wheater);
        const ajustedEnergy = new Decimal(projected)
          .minus(new Decimal(thisChangeProjectedData.changeProjectedData).div(100))
          .times(projected);
        const overused = new Decimal(projected)
          .minus(thisSingleFuelProjectedConsumption.consumption)
          .toDP(8)
          .toNumber();
        overusedEnergyRecords.push({
          date: thisSingleFuelProjectedConsumption.date,
          overused,
          siteId: thisSite,
          intercept,
        });
      }
    }
  }

  const wasteRecords: WasteValue[] = [];
  for (let s = 0; s < sites.length; s++) {
    const thisSite = sites[s];
    const thisSelectedYearConsumption = p.selectedYearConsumptions
      .filter(SitesService.filterBySiteId(thisSite))
      .filter(DashboardService.consumptionIsNotProduced);

    selectdYearLoop: for (let a = 0; a < thisSelectedYearConsumption.length; a++) {
      const selectedYearConsumption = thisSelectedYearConsumption[a];
      const thisSelectedYearHdd = p.selectedYearHdd
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth(selectedYearConsumption));
      const thisSingleFuelProjectedConsumptions = p.singleFuelProjectedConsumptions
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(selectedYearConsumption, 1) }));
      const overused = overusedEnergyRecords
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(selectedYearConsumption, 1) }));
      const change = lightingPowerDataChange
        .filter(SitesService.filterBySiteId(thisSite))
        .find(DbUtils.filterByYearAndMonth({ date: DbUtils.decreaseYear(selectedYearConsumption, 1) }));
      if (!overused || !change) {
        continue selectdYearLoop;
      }

      if (thisSelectedYearHdd && thisSingleFuelProjectedConsumptions) {
        const weather = new Decimal(thisSelectedYearHdd.value).times(thisSingleFuelProjectedConsumptions.consumption);
        const projected = new Decimal(weather).plus(overused.intercept);
        const adjusted = new Decimal(change.changeProjectedData).div(100).times(projected);
        const waste = new Decimal(new Decimal(adjusted).plus(projected))
          .minus(selectedYearConsumption.consumption)
          .toDP(4)
          .toNumber();
        wasteRecords.push({
          waste,
          date: selectedYearConsumption.date,
          fuelSourceId: selectedYearConsumption.fuelSourceId,
          siteId: selectedYearConsumption.siteId,
          consumption: selectedYearConsumption.consumption,
          wasteCost: wasteCost({ consumption: selectedYearConsumption, waste: waste }),
          siteName: selectedYearConsumption.siteName,
          fuelSourceName: selectedYearConsumption.fuelSourceName,
        });
      }
    }
  }

  return wasteRecords;
};

const calculateFinancialCost = (p: {
  consumptions: AppModels['UtilityConsumption'][];
  waste: Awaited<ReturnType<typeof calculateWaste>>;
}) => {
  const records = [];
  for (let i = 0; i < p.consumptions.length; i++) {
    const consumption = p.consumptions[i];
    const [waste] = p.waste
      .filter(DbUtils.filterByYearAndMonth(consumption))
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
  consumptions: (AppModels['UtilityConsumption'] & { produced?: boolean })[];
  emissions: Awaited<ReturnType<typeof UtilityService.getEmissions>>;
  waste: Awaited<ReturnType<typeof calculateWaste>>;
}) => {
  const records = [];
  for (let i = 0; i < p.consumptions.length; i++) {
    const consumption = p.consumptions[i];
    const [emission] = p.emissions
      .filter(DbUtils.filterByYearAndMonth(consumption))
      .filter(SitesService.filterBySiteId(consumption.siteId))
      .filter(UtilityService.filterByFuelSource(consumption.fuelSourceId));
    if (!emission) {
      continue;
    }

    const [waste] = p.waste
      .filter(DbUtils.filterByYearAndMonth(consumption))
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
      totalCost: consumption.totalCost,
      consumptionCarbonImpact: new Decimal(consumption.consumption).times(emission.emissionFactor).toDP(8).toNumber(),
      consumptionFinancialCost: new Decimal(new Decimal(consumption.totalCost).div(consumption.consumption))
        .times(consumption.consumption)
        .toDP(8)
        .toNumber(),
      wasteCarbonImpact: new Decimal(waste.waste).times(emission.emissionFactor).toDP(8).toNumber(),
      wasteCost: wasteCost({ consumption, waste: waste.waste }),
      produced: consumption.produced,
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
  wasteForPowerAndLightingAndCoolingV2,
  calculateFinancialCost,
  calculateCarbonImpact,
  filterSingleConsumptionForHeatingOrCooling,
  filterLightingAndPowerConsumption,
};
