import { DB } from '@lib';
import { RequestBodyParams } from '@types';

const createSite = async (params: RequestBodyParams<'Site'>) => {
  return DB('Sites').insert(params);
};

export default {
  createSite,
};
