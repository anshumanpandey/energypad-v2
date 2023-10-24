import { AppModels } from '@types';
import { Decimal } from 'decimal.js';
import { getDaysInMonth } from 'date-fns';
import { DbUtils, MathUtils } from '@utils';
import { SitesService, UtilityService } from '@services';
import formatISO from 'date-fns/formatISO';
import { FuelSource, GetConsumptionsParams } from './utility.service';

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

  return Array.from(consumptionMap.values()).sort(DbUtils.sortByStringDate);
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
  carbonTarget: number;
  increasedConsumptionPercentage: number;
  averageEmissionPerDay: number;
  siteId: number;
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
      return c.date.slice(0, 4) === e.date?.split('-')[0].toString() && c.siteId === e.siteId;
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
      siteName: p.siteName,
      fuelSourceId: p.fuelSourceId,
      fuelSourceName: p.fuelSourceName,
      fuelSourceColorCode: params.fuels?.find((i) => i.id === p.fuelSourceId)?.colorCode || '#4989C6',
      carbonEmission: p.consumption * p.conversionFactor,
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

const agroupConsumptionBySiteFuelsource = (consumptions: AppModels['UtilityConsumption'][]) => {
  const groups = [];
  const sitesId = uniqueElements(consumptions.map((c) => c.siteId));
  const fuelSourcesId = uniqueElements(consumptions.map((c) => c.fuelSourceId));

  for (let i = 0; i < consumptions.length; i++) {
    for (let siteIdx = 0; siteIdx < sitesId.length; siteIdx++) {
      const thisStatistics = [];
      for (let fuelSourcesIdx = 0; fuelSourcesIdx < fuelSourcesId.length; fuelSourcesIdx++) {
        const thisIterationConsumptions = consumptions
          .filter(UtilityService.filterByFuelSource(fuelSourcesId[fuelSourcesIdx]))
          .filter(SitesService.filterBySiteId(sitesId[siteIdx]));
        thisStatistics.push(thisIterationConsumptions);
      }
      groups.push(thisStatistics);
    }
  }
};

export default {
  getConsumptionStatistics,
  getConsumptionDetails,
  produceYearConsumptions,
  consumptionIsProduced,
  consumptionIsNotProduced,
  findCarbonEmissions,
};
