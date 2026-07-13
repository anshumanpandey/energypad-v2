import { DB } from '@lib';
import { DbUtils, UnitsUtil } from '@utils';
import { addPrefix } from '../utils/dbUtils';

const findBy = (p: { names: string | string[] }) => {
  if (p?.names) {
    if (Array.isArray(p.names)) {
      const names = p.names;
      return UnitsUtil.SupportedUnits.filter((unit) => names.map((u) => u.toLowerCase()).includes(unit.toLowerCase()));
    } else {
      const names = p.names;
      return UnitsUtil.SupportedUnits.filter((unit) => unit.toLowerCase() === names.toLowerCase());
    }
  }
  return UnitsUtil.SupportedUnits;
};

export type TargetConsumption = {
  id: number;
  date: string;
  fuelSourceId: number;
  siteId: number;
  factorUnits: { targetCarbon: number; targetValue: number; fuelUnit: string }[];
};
const getTargetConsumption = async (p: {
  date?: string | string[];
  fuelSource?: number | number[];
  siteId?: number | number[];
  year?: Date;
}): Promise<TargetConsumption[]> => {
  const query = DB('TargetConsumption')
    .select(['TargetConsumption.*', ...addPrefix('TCFC')(['targetValue', 'fuelUnit', 'targetCarbon'])])
    .innerJoin({ TCFC: 'TargetConsumptionFuelConversion' }, 'TargetConsumption.id', 'TCFC.targetConsumptionId');

  if (p.year) {
    query.where('date', DbUtils.dateToStringDate(p.year));
    query.where('date', 'like', p.year.getFullYear() + '%');
  }

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
        targetCarbon: record['TCFC-targetCarbon'],
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
            targetCarbon: record['TCFC-targetCarbon'],
            fuelUnit: record['TCFC-fuelUnit'],
          },
        ],
      });
    }
  }

  return Array.from(records.values());
};

export default {
  findBy,
  getTargetConsumption,
};
