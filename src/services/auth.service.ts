import { sign } from 'jsonwebtoken';
import { DB, GlobalEnv } from '@lib';
import { RequestBodyParams } from '@types';
import { encryptPassword } from '@utils';

const registerUser = async (params: RequestBodyParams<'Register'>) => {
  const { floors, ...p } = params;
  const businessParams = {
    ...p,
    password: await encryptPassword(p.password),
  };

  return DB.transaction(function (trx) {
    return trx('Businesses')
      .insert(businessParams)
      .then(() => trx('Floors').insert(floors));
  });
};

const generateJwt = (user: { id: string }) => {
  return sign(user, GlobalEnv.JWT_SECRET);
};

export default {
  registerUser,
  generateJwt,
};
