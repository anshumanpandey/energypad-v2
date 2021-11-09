import { DB } from '@lib';
import { RequestBodyParams } from '@types';
import { encryptPassword } from '@utils';

const registerUser = async (p: RequestBodyParams<'Register'>) => {
  const params: RequestBodyParams<'Register'> = {
    ...p,
    password: await encryptPassword(p.password),
  };
  return DB('Users').insert(params);
};

export default {
  registerUser,
};
