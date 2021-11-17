import { sign } from 'jsonwebtoken';
import { DB, GlobalEnv } from '@lib';
import { RequestBodyParams, Transactionable } from '@types';
import { encryptPassword } from '@utils';

const registerUser = async (params: RequestBodyParams<'Register'>, opt?: Transactionable) => {
  const { floors, ...p } = params;
  const businessParams = {
    ...p,
    password: await encryptPassword(p.password),
  };

  const query = DB('Businesses').insert(businessParams).returning('id');

  if (opt?.txr) {
    query.transacting(opt?.txr);
  }

  if (floors.length !== 0) {
    return query.then((insertedId) => {
      const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId: insertedId });
      const floorsData = floors.map(mapFloors);
      const floorQuery = DB('Floors').insert(floorsData);
      if (opt?.txr) {
        floorQuery.transacting(opt?.txr);
      }
      return floorQuery;
    });
  }

  return query;
};

const generateJwt = (user: { id: number }) => {
  return sign(user, GlobalEnv.JWT_SECRET);
};

export default {
  registerUser,
  generateJwt,
};
