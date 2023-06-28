import { AuthGetAppController } from '@types';
import { UnitsUtil } from '@utils';

export const getConversionUnitValues: AuthGetAppController<'GetConversionUnit', '/api/conversionUnit/'> = async (
  req,
) => {
  const units = req.query.fuelSource?.toString()?.split(',') as Array<UnitsUtil.ONE_OF_SUPPORTED_UNIT>;
  return [{ unit: 'kWh', value: 1 }];
};
