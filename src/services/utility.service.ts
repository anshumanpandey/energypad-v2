import { DB } from '@lib';
import Decimal from 'decimal.js';
import { formatISO } from 'date-fns';
import { AppModels, RequestBodyParams, Transactionable } from '@types';

export type AddConsumptionToUtilityParam = {
  fuelSourceId: number;
} & RequestBodyParams<'AddFuelSourceConsumption'>;
const addConsumptionToUtility = async (
  params: AddConsumptionToUtilityParam | AddConsumptionToUtilityParam[],
  opt?: Transactionable,
) => {
  const query = DB('UtilityConsumptions').insert(params);

  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query;
};

const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
};

type DeleteByParams = {
  month?: Date;
  fuelSourceId?: number;
  siteId?: number;
};
const deleteBy = (p: DeleteByParams) => {
  const query = DB('UtilityConsumptions').delete();

  if (p.month) {
    const [year, month] = formatISO(p.month).split('T')[0].split('-');
    query.where('date', 'like', `${year}-${month}%`);
  }

  if (p.fuelSourceId) {
    query.where('fuelSourceId', p.fuelSourceId);
  }
  if (p.siteId) {
    query.where('siteId', p.siteId);
  }
  return query.del();
};

type GetEmissionsParams = { businessId: number };
const getEmissions = (params: GetEmissionsParams): Promise<AppModels['UtilityEmission'][]> => {
  const query = DB('UtilityEmissions')
    .select(['UtilityEmissions.*', { fuelSourceId: 'FuelSources.id' }])
    .innerJoin('FuelSources', 'UtilityEmissions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ B: 'Businesses' }, 'UtilityEmissions.businessId', 'B.id')
    .where('B.id', params.businessId);

  return query;
};

type GetConsumptionsParams = {
  businessId: number;
  startDate?: Date;
  endDate?: Date;
  fuelSourceId?: number;
  siteId?: number;
};
const getConsumptions = (params: GetConsumptionsParams): Promise<AppModels['UtilityConsumption'][]> => {
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

  if (params.fuelSourceId) {
    query.where('FuelSources.id', params.fuelSourceId);
  }

  if (params.siteId) {
    query.where('UtilityConsumptions.siteId', params.siteId);
  }

  return query;
};

type FuelSourceRecord = Omit<AppModels['FuelSource'], 'usedIn'> & { id: number; use: string; fuelUseId: number };
type FuelSource = AppModels['FuelSource'] & { id: number };
const getFuelSources = async (): Promise<FuelSource[]> => {
  const query = DB('FuelSources')
    .select(['FuelSources.*', 'FuelUses.use', { fuelUseId: 'FuelUses.id' }])
    .innerJoin({ FUTOFS: 'UsedInToFuelSource' }, 'FuelSources.id', 'FUTOFS.fuelSourceId')
    .innerJoin('FuelUses', 'FUTOFS.usedInId', 'FuelUses.id');

  const records = await query;

  const reduceRecords = (r: FuelSourceRecord[]) => {
    const map = new Map();
    for (let i = 0, len = r.length; i < len; i++) {
      const el = r[i];
      const current = map.get(el.id);
      if (current) {
        current.usedIn.push({ use: el.use, id: el.fuelUseId });
        map.set(el.id, current);
      } else {
        const { use, fuelUseId, ...fuel } = el;
        map.set(el.id, {
          ...fuel,
          usedIn: [{ use, id: fuelUseId }],
        });
      }
    }

    return Array.from(map.values());
  };

  return reduceRecords(records);
};

type FindFuelByParams = {
  fuelSourceId?: number | number[];
};
const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; use: string }[]> => {
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
const findFuelUseBy = (p: FindFuelUseByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelUses').select('FuelUses.*');

  if (p.id) {
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
const addUtilityEmissions = (p: AddUtilityEmissionsParams[]) => {
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

const consumingProjection = async (p: ConsummingStaticsticsParams) => {
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

export default {
  addConsumptionToUtility,
  getSavingTips,
  findFuelBy,
  getFuelSources,
  addUtilityEmissions,
  getEmissions,
  getConsumptions,
  findFuelUseBy,
  consumingProjection,
  deleteBy,
};
