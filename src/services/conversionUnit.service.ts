import { DB } from '@lib';
import Decimal from 'decimal.js';
import { UnitsUtil } from '@utils';
import { addPrefix } from '../utils/dbUtils';

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

const getTargetConsumption = async (p: {
  date?: string | string[];
  fuelSource?: number | number[];
  siteId?: number | number[];
}) => {
  const query = DB('TargetConsumption')
    .select(['TargetConsumption.*', ...addPrefix('TCFC')(['targetValue', 'fuelUnit'])])
    .innerJoin({ TCFC: 'TargetConsumptionFuelConversion' }, 'TargetConsumption.id', 'TCFC.targetConsumptionId');

  if (p.date) {
    if (Array.isArray(p.date)) {
      const dates = p.date;
      query.where((builder) => {
        dates.forEach((i) => builder.orWhere('date', i));
      });
    } else {
      query.where('date', p.date);
    }
  }

  if (p.fuelSource) {
    if (Array.isArray(p.fuelSource)) {
      const fuels = p.fuelSource;
      query.where((builder) => {
        fuels.forEach((i) => builder.orWhere('fuelSourceId', i));
      });
    } else {
      query.where('fuelSourceId', p.fuelSource);
    }
  }

  if (p.siteId) {
    if (Array.isArray(p.siteId)) {
      const sites = p.siteId;
      query.where((builder) => {
        sites.forEach((i) => builder.orWhere('siteId', i));
      });
    } else {
      query.where('siteId', p.siteId);
    }
  }

  const results = await query;
  const records = new Map();

  for (let idx = 0; idx < results.length; idx++) {
    const record = results[idx];

    const foundRecord = records.get(record.id);
    if (foundRecord) {
      foundRecord.factorUnits.push({
        targetValue: record['TCFC-targetValue'],
        fuelUnit: record['TCFC-fuelUnit'],
      });
      records.set(record.id, foundRecord);
    } else {
      records.set(record.id, {
        id: record.id,
        date: record.date,
        fuelSourceId: record.fuelSourceId,
        siteId: record.siteId,
        factorUnits: [
          {
            targetValue: record['TCFC-targetValue'],
            fuelUnit: record['TCFC-fuelUnit'],
          },
        ],
      });
    }
  }

  return Array.from(records.values());
};

const getConversionValue = (p: {
  fuelSource?: keyof typeof UnitsUtil.ConversionValues | Array<keyof typeof UnitsUtil.ConversionValues>;
}): Array<{ unit: keyof typeof UnitsUtil.ConversionValues; value: number }> => {
  if (p.fuelSource) {
    if (Array.isArray(p.fuelSource)) {
      const values = [];
      for (let i = 0; i < p.fuelSource.length; i++) {
        const unit = p.fuelSource[i];
        values.push({ unit: unit, value: UnitsUtil.ConversionValues[unit] });
      }
      return values;
    } else {
      return [{ unit: p.fuelSource, value: UnitsUtil.ConversionValues[p.fuelSource] }];
    }
  }
  return Object.entries(UnitsUtil.ConversionValues).map((entry) => ({
    unit: entry[0] as keyof typeof UnitsUtil.ConversionValues,
    value: entry[1],
  }));
};

export default {
  buildConversionFnForSite,
  findBy,
  getTargetConsumption,
  getConversionValue,
};
