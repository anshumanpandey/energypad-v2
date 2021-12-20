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

type FuelSourceRecord = Omit<AppModels['FuelSource'], 'usedIn'> & { id: number; use: string };
type FuelSource = AppModels['FuelSource'] & { id: number };
const getFuelSources = async (): Promise<FuelSource[]> => {
  const query = DB('FuelSources')
    .select(['FuelSources.*', 'FuelUses.use'])
    .innerJoin('FuelUses', 'FuelSources.id', 'FuelUses.fuelSourceId');

  const records = await query;

  const reduceRecords = (r: FuelSourceRecord[]) => {
    const map = new Map();
    for (let i = 0, len = r.length; i < len; i++) {
      const el = r[i];
      const current = map.get(el.id);
      if (current) {
        current.usedIn.push(el.use);
        map.set(el.id, current);
      } else {
        const { use, ...fuel } = el;
        map.set(el.id, {
          ...fuel,
          usedIn: [use],
        });
      }
    }

    return Array.from(map.values());
  };

  return reduceRecords(records);
};

type FindFuelByParams = {
  usedInId?: number;
  fuelSourceId?: number;
};
const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelSources')
    .select('FuelSources.*')
    .innerJoin('FuelUses', 'FuelSources.id', 'FuelUses.fuelSourceId');

  if (p.usedInId) {
    query.where('FuelUses.id', p.usedInId);
  }

  if (p.fuelSourceId) {
    query.where('FuelSources.id', p.fuelSourceId);
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
};
