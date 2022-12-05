import { DB } from '@lib';
import Decimal from 'decimal.js';
import { UnitsUtil } from '@utils';

type ParentParams = Parameters<UnitsUtil.ConversionResolverFn>;
type ReturnType = (value: ParentParams[0], unit: ParentParams[1], siteId?: number) => number;

const buildConversionFnForSite = async (s: { siteId: number[] }): Promise<ReturnType> => {
  const conversionUnits = await DB('SiteConversionUnits').select('').whereIn('siteId', s.siteId);
  if (conversionUnits.length === 0) return UnitsUtil.resolveUnitConversion;

  return (value, unit?, siteId?) => {
    const unitFound = conversionUnits.find((i) => i.unitType === unit && siteId === i.siteId);
    if (!unitFound) return UnitsUtil.resolveUnitConversion(value, unit);

    return new Decimal(value).times(unitFound.unitValue).toNumber();
  };
};

const findBy = (p: { names: string | string[] }) => {
  if (p?.names) {
    if (Array.isArray(p.names)) {
      return UnitsUtil.SupportedUnits.filter((unit) => p.names.includes(unit));
    } else {
      return UnitsUtil.SupportedUnits.filter((unit) => unit === p.names);
    }
  }
  return UnitsUtil.SupportedUnits;
};

export default {
  buildConversionFnForSite,
  findBy,
};
