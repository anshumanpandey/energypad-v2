import { DB } from '@lib';
import { RequestBodyParams } from '@types';

const create = async (params: RequestBodyParams<'CreateUtility'>) => {
  return DB('Utilities').insert(params);
};

export default {
  create,
};
