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
      .returning('id')
      .then((insertedId) => {
        const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId: insertedId });
        const floorsData = floors.map(mapFloors);
        return trx('Floors').insert(floorsData);
      });
  });
};

const generateJwt = (user: { id: number }) => {
  return sign(user, GlobalEnv.JWT_SECRET);
};

export default {
  registerUser,
  generateJwt,
};
