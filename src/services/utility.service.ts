import { DB } from '@lib';
import { AppModels, RequestBodyParams } from '@types';

const create = async (params: RequestBodyParams<'CreateUtility'>) => {
  return DB('Utilities').insert(params);
};

export type AddConsumptionToUtilityParam = { utilityId: number } & RequestBodyParams<'AddUtilityEmission'>;
const addConsumptionToUtility = async (params: AddConsumptionToUtilityParam | AddConsumptionToUtilityParam[]) => {
  return DB('UtilityConsumptions').insert(params);
};

const findBy = async (by: { name: string | string[]; businessId?: number }): Promise<AppModels['Utility'][]> => {
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

  return query;
};

export default {
  create,
  addConsumptionToUtility,
  findBy,
};
