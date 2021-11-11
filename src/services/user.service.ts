import { DB } from '@lib';
import { AppModels } from '@types';

const getUserBy = (params: { id?: string; email?: string }) => {
  const query = DB('Businesses').select<AppModels['User']>('*');
  if (params.id) {
    query.where({ id: params.id });
  }
  if (params.email) {
    query.where({ email: params.email });
  }
  return query.first();
};

export default {
  getUserBy,
};
