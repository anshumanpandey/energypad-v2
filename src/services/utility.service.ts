import { DB } from '@lib';
import { AppModels, RequestBodyParams, Transactionable } from '@types';
import { getSinglePropArr } from '@utils';

const create = async (params: RequestBodyParams<'CreateUtility'>, opt?: Transactionable) => {
  const query = DB('Utilities').insert(params);
  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query;
};

export type AddConsumptionToUtilityParam = { utilityId: number } & RequestBodyParams<'AddUtilityConsumption'>;
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

const findBy = async (by: {
  name?: string | string[];
  businessId?: number;
  id?: number;
}): Promise<AppModels['Utility'][]> => {
  const query = DB('Utilities');

  if (by.name) {
    if (Array.isArray(by.name)) {
      query.whereIn('name', by.name);
    } else {
      query.where({ name: by.name });
    }
  }

  if (by.businessId) {
    query.where({ businessId: by.businessId });
  }

  if (by.id) {
    query.where({ id: by.id });
  }

  return query;
};

const getConsumptionPerUtility = (p: { utilityId: number | number[] }): Promise<AppModels['UtilityConsumption'][]> => {
  const query = DB('UtilityConsumptions');

  if (Array.isArray(p.utilityId)) {
    query.whereIn('utilityId', p.utilityId);
  } else {
    query.where('utilityId', p.utilityId);
  }
  return query;
};

const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
};

type FindFuelByParams = {
  usedInId?: number;
};
const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; use: string }[]> => {
  const query = DB('FuelSources')
    .select('FuelSources.*')
    .innerJoin('FuelUses', 'FuelSources.id', 'FuelUses.fuelSourceId');

  if (p.usedInId) {
    query.where('FuelUses.id', p.usedInId);
  }

  return query;
};

type SetUtilityEmissionsParams = {
  businessId: number;
  siteId: number;
  usedInId: number;
  year: number;
  emissionFactor: string;
  value: number;
};
const setUtilityEmissions = (p: SetUtilityEmissionsParams[]) => {
  return DB.transaction((trx) => {
    const delQuery = trx('UtilityEmissions')
      .where((builder) =>
        builder
          .whereIn('siteId', getSinglePropArr({ arr: p, prop: 'siteId' }))
          .whereIn('usedInId', getSinglePropArr({ arr: p, prop: 'usedInId' }))
          .whereIn(
            'siteId',
            trx('Sites')
              .select(['id'])
              .whereIn('businessId', getSinglePropArr({ arr: p, prop: 'businessId' })),
          ),
      )
      .del();

    return delQuery.then(() => {
      const mapRecord = (r: typeof p[0]) => {
        const { businessId: _, ...data } = r;
        return data;
      };
      const query = trx('UtilityEmissions').insert(p.map(mapRecord));
      return query;
    });
  });
};

export default {
  create,
  addConsumptionToUtility,
  findBy,
  getConsumptionPerUtility,
  getSavingTips,
  findFuelBy,
  setUtilityEmissions,
};
