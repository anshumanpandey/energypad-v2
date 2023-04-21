import { AuthGetAppController } from '@types';
import { ConversionUnitServices } from '@services';
import { UnitsUtil } from '@utils';

export const getConversionUnitValues: AuthGetAppController<'GetConversionUnit', '/api/conversionUnit/'> = async (
  req,
) => {
  const units = req.query.fuelSource?.toString()?.split(',') as Array<keyof typeof UnitsUtil.ConversionValues>;
  const values = ConversionUnitServices.getConversionValue({ fuelSource: units });
  return values;
};
