import { DB } from '@lib';
import { RequestBodyParams } from '@types';

const createSite = async (params: RequestBodyParams<'Site'>) => {
  return DB('Sites').insert(params);
};

type FindByParams = {
  id?: number;
  businessId?: number;
};
const findBy = async (params?: FindByParams) => {
  const query = DB('Sites').select();
  if (params?.id) {
    query.where('id', params.id);
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
