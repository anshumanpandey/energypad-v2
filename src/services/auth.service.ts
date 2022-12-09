import { sign } from 'jsonwebtoken';
import { DB, GlobalEnv } from '@lib';
import { RequestBodyParams, Transactionable } from '@types';
import { encryptPassword } from '@utils';

const registerUser = async (params: RequestBodyParams<'Register'>, opt?: Transactionable) => {
  const { ...p } = params;
  const businessParams = {
    ...p,
  };

  if (p.password) {
    businessParams.password = await encryptPassword(p.password);
  }

  const query = DB('Businesses').insert(businessParams);

  if (opt?.txr) {
    query.transacting(opt.txr);
  }

  const [insertedId] = await query;

  return insertedId;
};

const generateJwt = (user: { id: number }) => {
  return sign(user, GlobalEnv.JWT_SECRET);
};

export default {
  registerUser,
  generateJwt,
};
