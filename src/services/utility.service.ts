import { DB } from '@lib';
import { AppModels, RequestBodyParams, Transactionable } from '@types';

export type AddConsumptionToUtilityParam = {
  businessId: number;
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

const getConsumptionBy = (p: {
  businessId?: number;
  fuelSourceId?: number | number[];
}): Promise<AppModels['UtilityConsumption'][]> => {
  const query = DB('UtilityConsumptions');

  if (p.fuelSourceId && Array.isArray(p.fuelSourceId)) {
    query.whereIn('fuelSourceId', p.fuelSourceId);
  } else if (p.fuelSourceId && Array.isArray(p.fuelSourceId) === false) {
    query.where('fuelSourceId', p.fuelSourceId);
  }

  if (p.businessId) {
    query.where('businessId', p.businessId);
  }
  return query;
};

const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
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

type GetConsumptionsParams = { businessId: number };
const getConsumptions = (params: GetConsumptionsParams): Promise<AppModels['UtilityConsumption'][]> => {
  const query = DB('UtilityConsumptions')
    .select(['UtilityConsumptions.*', { fuelSourceId: 'FuelSources.id' }])
    .innerJoin('FuelSources', 'UtilityConsumptions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ B: 'Businesses' }, 'UtilityConsumptions.businessId', 'B.id')
    .where('B.id', params.businessId);

  return query;
};

type FuelSourceRecord = Omit<AppModels['FuelSource'], 'usedIn'> & { id: number; use: string; fuelUseId: number };
type FuelSource = AppModels['FuelSource'] & { id: number };
const getFuelSources = async (): Promise<FuelSource[]> => {
  const query = DB('FuelSources')
    .select(['FuelSources.*', 'FuelUses.use', { fuelUseId: 'FuelUses.id' }])
    .innerJoin('FuelUses', 'FuelSources.id', 'FuelUses.fuelSourceId');

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
  usedInId?: number;
  fuelSourceId?: number | number[];
};
const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  if (p.usedInId) {
    query.where('FuelUses.id', p.usedInId);
  }

  if (p.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('FuelSources.id', p.fuelSourceId);
    } else {
      query.where('FuelSources.id', p.fuelSourceId);
    }
  }

  return query;
};

type AddUtilityEmissionsParams = {
  year: number;
  emissionFactor: string;
  value: number;
  fuelSourceId: number;
  businessId: number;
};
const addUtilityEmissions = (p: AddUtilityEmissionsParams[]) => {
  return DB.transaction((trx) => {
    const query = trx('UtilityEmissions').insert(p);
    return query;
  });
};

export default {
  addConsumptionToUtility,
  getConsumptionBy,
  getSavingTips,
  findFuelBy,
  getFuelSources,
  addUtilityEmissions,
  getEmissions,
  getConsumptions,
};
