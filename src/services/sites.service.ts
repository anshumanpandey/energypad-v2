import { DB } from '@lib';
import { AppModels, RequestBodyParams } from '@types';

const createSite = async (params: RequestBodyParams<'Site'>) => {
  return DB('Sites').insert(params);
};

type FindByParams = {
  id?: number | number[];
  businessId?: number;
};
const findBy = async (params?: FindByParams): Promise<(AppModels['Site'] & { id: number })[]> => {
  const query = DB('Sites').select();
  if (params?.id) {
    Array.isArray(params.id) ? query.whereIn('id', params.id) : query.where('id', params.id);
  }
  if (params?.businessId) {
    query.where('businessId', params.businessId);
  }

  return query;
};

export default {
  findBy,
  createSite,
};
