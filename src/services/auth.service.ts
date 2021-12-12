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

  const query = DB('Businesses').insert(businessParams);

  if (opt?.txr) {
    query.transacting(opt.txr);
  }

  if (floors.length !== 0) {
    const insertedId = await query;

    const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId: insertedId[0] });
    const floorsData = floors.map(mapFloors);
    const floorQuery = DB('Floors').insert(floorsData);
    if (opt?.txr) {
      floorQuery.transacting(opt.txr);
    }
    await floorQuery;
    return insertedId;
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
