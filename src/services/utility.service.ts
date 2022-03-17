import { DB } from '@lib';
import Decimal from 'decimal.js';
import { formatISO } from 'date-fns';
import { AppModels, RequestBodyParams, Transactionable } from '@types';
import { DbUtils } from '@utils';

export type AddConsumptionToUtilityParam = RequestBodyParams<'AddFuelSourceConsumption'>;
export const addConsumptionToUtility = async (params: AddConsumptionToUtilityParam, opt?: Transactionable) => {
  const query = DB('UtilityConsumptions').insert(params);

  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query;
};

export const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
};

type DeleteByParams = {
  month?: Date | Date[];
  fuelSourceId?: number | number[];
  siteId?: number | number[];
};
export const deleteBy = (p: DeleteByParams) => {
  const query = DB('UtilityConsumptions').delete();

  if (p.month) {
    if (Array.isArray(p.month)) {
      const dates = Array.from(new Set(p.month.sort(DbUtils.sortByDate)).values());
      query.where((q) => {
        const asignDate = (i: string) => q.orWhere('date', i);
        dates.map(DbUtils.dateToStringDate).map(asignDate);
      });
    } else {
      const [year, month] = formatISO(p.month).split('T')[0].split('-');
      query.where('date', 'like', `${year}-${month}%`);
    }
  }

  if (p.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('fuelSourceId', Array.from(new Set(p.fuelSourceId).values()));
    } else {
      query.where('fuelSourceId', p.fuelSourceId);
    }
  }
  if (p.siteId) {
    if (Array.isArray(p.siteId)) {
      query.whereIn('siteId', Array.from(new Set(p.siteId).values()));
    } else {
      query.where('siteId', p.siteId);
    }
  }
  return query.del();
};

export type GetEmissionsParams = { businessId: number; forYear?: Date; siteId?: number };
export const getEmissions = (params: GetEmissionsParams): Promise<AppModels['UtilityEmission'][]> => {
  const query = DB('UtilityEmissions')
    .select(['UtilityEmissions.*', { fuelSourceId: 'FuelSources.id' }])
    .innerJoin('FuelSources', 'UtilityEmissions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ S: 'Sites' }, 'UtilityEmissions.siteId', 'S.id')
    .innerJoin({ B: 'Businesses' }, 'S.businessId', 'B.id')
    .where('B.id', params.businessId);

  if (params.siteId) {
    query.where('UtilityEmissions.siteId', params.siteId);
  }

  if (params.forYear) {
    query.where('UtilityEmissions.year', params.forYear.getFullYear());
  }

  return query;
};

export type GetConsumptionsParams = {
  businessId: number;
  forMonth?: Date;
  startDate?: Date;
  endDate?: Date;
  fuelSourceId?: number;
  siteId?: number;
};
export const getConsumptions = (params: GetConsumptionsParams): Promise<AppModels['UtilityConsumption'][]> => {
  const query = DB('UtilityConsumptions')
    .select(['UtilityConsumptions.*', { fuelSourceId: 'FuelSources.id' }, { fuelSourceName: 'FuelSources.source' }])
    .innerJoin('FuelSources', 'UtilityConsumptions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ S: 'Sites' }, 'UtilityConsumptions.siteId', 'S.id')
    .innerJoin({ B: 'Businesses' }, 'S.businessId', 'B.id')
    .where('B.id', params.businessId);

  if (params.startDate) {
    const dateParam: string = formatISO(params.startDate).split('T')[0];
    query.where('UtilityConsumptions.date', '>=', dateParam);
  }

  if (params.endDate) {
    const dateParam: string = formatISO(params.endDate).split('T')[0];
    query.where('UtilityConsumptions.date', '<=', dateParam);
  }

  if (params.forMonth) {
    const dateParam: string = formatISO(params.forMonth).split('T')[0];
    query.where('UtilityConsumptions.date', 'like', dateParam.slice(0, 7) + '-%');
  }

  if (params.fuelSourceId) {
    query.where('FuelSources.id', params.fuelSourceId);
  }

  if (params.siteId) {
    query.where('UtilityConsumptions.siteId', params.siteId);
  }

  return query;
};

type FuelSource = AppModels['FuelSource'] & { id: number };
export const getFuelSources = async (): Promise<FuelSource[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  const records = await query;

  return records;
};

type FindFuelByParams = {
  fuelSourceId?: number | number[];
};
export const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  if (p.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('FuelSources.id', p.fuelSourceId);
    } else {
      query.where('FuelSources.id', p.fuelSourceId);
    }
  }

  return query;
};

type FindFuelUseByParams = {
  id?: number | number[];
};
export const findFuelUseBy = (p?: FindFuelUseByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelUses').select('FuelUses.*');

  if (p?.id) {
    if (Array.isArray(p.id)) {
      query.whereIn('id', p.id);
    } else {
      query.where('id', p.id);
    }
  }

  return query;
};

type AddUtilityEmissionsParams = {
  year: number;
  emissionFactor: string;
  value: number;
  fuelSourceId: number;
  siteId: number;
};
export const addUtilityEmissions = (p: AddUtilityEmissionsParams[]) => {
  return DB.transaction((trx) => {
    const query = trx('UtilityEmissions').insert(p);
    return query;
  });
};

type ConsumptionRecord = { consumption: number; date: string };
type Hdd = { date: Date; value: number };
type ConsummingStaticsticsParams = {
  pastConsumptionRecords: ConsumptionRecord[];
  currentConsumptionRecords: ConsumptionRecord[];
  pastHdds: Hdd[];
  currentHdd: Hdd[];
};

const NX = 6;

export const consumingProjection = async (p: ConsummingStaticsticsParams) => {
  const patterns = p.pastConsumptionRecords;

  const totalOfHdd = p.pastHdds.reduce((total, next) => new Decimal(total).plus(next.value).toNumber(), 0);
  const totalOfConsumption = patterns.reduce((total, next) => new Decimal(total).plus(next.consumption).toNumber(), 0);
  const totalOfHddPower = p.pastHdds.reduce(
    (total, next) => new Decimal(next.value).times(next.value).plus(total).toNumber(),
    0,
  );

  const hddPerEnergy = patterns.map((item, idx) =>
    new Decimal(p.pastHdds[idx] ? p.pastHdds[idx].value : 0).times(item.consumption).toNumber(),
  );

  const totalOfHddPerEnergy = hddPerEnergy.reduce((total, next) => new Decimal(total).plus(next).toNumber(), 0);

  const a9Top = new Decimal(new Decimal(totalOfConsumption).times(totalOfHddPower))
    .minus(new Decimal(totalOfHdd).times(totalOfHddPerEnergy))
    .toNumber();

  const b9Top = new Decimal(new Decimal(NX).times(totalOfHddPerEnergy))
    .minus(new Decimal(totalOfHdd).times(totalOfConsumption))
    .toNumber();
  const belowVal = new Decimal(new Decimal(NX).times(totalOfHddPower))
    .minus(new Decimal(totalOfHdd).times(totalOfHdd))
    .toNumber();

  const intercept = new Decimal(a9Top).dividedBy(belowVal).toDecimalPlaces(8).toNumber();
  const slope = new Decimal(b9Top).dividedBy(belowVal).toDecimalPlaces(8).toNumber();

  const reducedData = [];

  for (let idx = 1, len = p.currentHdd.length; idx < len; idx++) {
    const item = p.currentHdd[idx];
    const s = new Decimal(item.value).times(slope).toNumber();
    const projectedEnergy = new Decimal(intercept).plus(s).toNumber();
    reducedData.push({
      date: formatISO(item.date).split('T')[0],
      consumption: p.currentConsumptionRecords[idx].consumption,
      //hdd: i.value,
      //slope: s,
      projectedEnergy: projectedEnergy,
      /*saving: new Decimal(projectedEnergy)
        .minus(p.currentConsumptionRecords[idx] ? p.currentConsumptionRecords[idx].consumption : 0)
        .toNumber(),*/
    });
  }

  return reducedData;
};
