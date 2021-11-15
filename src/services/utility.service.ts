import { DB } from '@lib';
import { RequestBodyParams } from '@types';

const create = async (params: RequestBodyParams<'CreateUtility'>) => {
  return DB('Utilities').insert(params);
};

const addConsumptionToUtility = async (params: RequestBodyParams<'AddUtilityEmission'>) => {
  return DB('UtilityConsumptions').insert(params);
};

export default {
  create,
  addConsumptionToUtility,
};
