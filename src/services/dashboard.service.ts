import { AppModels } from '@types';
import { Decimal } from 'decimal.js';
import { addMonths, differenceInMonths, getDaysInMonth } from 'date-fns';
import { DbUtils, MathUtils } from '@utils';
import { UtilityService } from '@services';
import formatISO from 'date-fns/formatISO';

const getConsumptionStatistics = ({
  consumptions,
}: {
  consumptions: Pick<AppModels['UtilityConsumption'], 'date' | 'consumption' | 'cost'>[];
}) => {
  const filterByMonth = (monthToSearch: number) => (c: typeof consumptions[0]) => {
    const [, month] = c.date.split('-');
    return new Decimal(month).equals(monthToSearch);
  };

  const getAverage = (record: typeof consumptions[0], of: 'consumption' | 'cost') => {
    const date = DbUtils.stringDateToDate(record.date);
    const amountOfDaysOnMonth = getDaysInMonth(date);
    return new Decimal(record[of]).dividedBy(amountOfDaysOnMonth).toDecimalPlaces(2).toNumber();
  };

  const consumptionStatistics = [];
  for (let idx = 1; idx <= consumptions.length; idx++) {
    const consumptionFilter = filterByMonth(idx);
    const consumptionOfMonth = consumptions.filter(consumptionFilter).sort(DbUtils.sortByStringDate);

    if (consumptionOfMonth.length === 0) {
      break;
    }

    const mostRecentRecord = consumptionOfMonth[consumptionOfMonth.length - 1];
    const previouseRecord = consumptions[idx - 1];

    const data = {
      date: `${consumptionOfMonth[0].date.split('-')[0]}-${('0' + idx).slice(-2)}-01`,
      averageConsumption: getAverage(consumptionOfMonth[0], 'consumption'),
      averageCost: getAverage(consumptionOfMonth[0], 'cost'),
      cost: mostRecentRecord ? mostRecentRecord.cost : 0,
      consumption: mostRecentRecord ? mostRecentRecord.consumption : 0,
      increasedConsumptionPercentage: MathUtils.calculateIncreasePercentage({
        currentValue: mostRecentRecord.consumption,
        passValue: previouseRecord.consumption,
      }),
      increasedCostPercentage: MathUtils.calculateIncreasePercentage({
        currentValue: mostRecentRecord.cost,
        passValue: previouseRecord.cost,
      }),
    };
    consumptionStatistics.push(data);
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
  consumptions,
}: {
  consumptions: Pick<AppModels['UtilityConsumption'], 'date' | 'consumption' | 'cost' | 'fuelSourceName'>[];
}) => {
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
      fuelSourceName: currentRecord.fuelSourceName,
      consumption: currentRecord.consumption,
      incesedPercentage: MathUtils.calculateIncreasePercentage({
        passValue: previousRecord.consumption,
        currentValue: currentRecord.consumption,
      }),
    });
  }
  return consumptionDetails;
};

const getConsumptionDetails = ({
  consumptions,
}: {
  consumptions: Pick<AppModels['UtilityConsumption'], 'date' | 'consumption' | 'cost' | 'fuelSourceName'>[];
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

const generateMockConsumption = (p: { date: string }) => {
  return {
    date: p.date,
    consumption: 0,
    cost: 0,
    siteId: 0,
    id: 0,
    fuelSourceName: '',
    produced: true,
  };
};
type ProduceYearConsumptionsParams = {
  startDate: Date;
  endDate: Date;
  businessId: number;
  fuelSourceId: number;
  siteId: number;
};

type ProduceYearConsumptionsOptions = {
  fillStartOnly: boolean;
};
const produceYearConsumptions = async (p: ProduceYearConsumptionsParams, opt?: ProduceYearConsumptionsOptions) => {
  const consumptionParams = {
    businessId: p.businessId,
    startDate: p.startDate,
    endDate: p.endDate,
    fuelSourceId: p.fuelSourceId,
    siteId: p.siteId,
  };

  const monthsBetweenDates = Math.abs(differenceInMonths(p.startDate, p.endDate));

  const consumption = await UtilityService.getConsumptions(consumptionParams);

  const consumptionMap = new Map<string, typeof consumption[0]>();

  const fillMap = (i: typeof consumption[0]) => {
    consumptionMap.set(i.date, i);
  };
  consumption.forEach(fillMap);

  let amountElementsFounds = 0;

  for (let idx = 0; idx <= monthsBetweenDates; idx++) {
    const dateToFind = formatISO(addMonths(p.startDate, idx), { representation: 'date' });
    const found = consumptionMap.get(dateToFind);

    if (!found) {
      const date = addMonths(p.startDate, idx);
      const formattedDate = formatISO(date, { representation: 'date' });
      consumptionMap.set(formattedDate, generateMockConsumption({ date: formattedDate }));
    } else {
      amountElementsFounds = amountElementsFounds + 1;
      if (opt?.fillStartOnly === true && amountElementsFounds === consumption.length) {
        break;
      }
    }
  }

  return Array.from(consumptionMap.values());
};

const consumptionIsProduced = (i: any) => {
  return i.produced && i.produced === true;
};

export default {
  getConsumptionStatistics,
  getConsumptionDetails,
  produceYearConsumptions,
  consumptionIsProduced,
};
