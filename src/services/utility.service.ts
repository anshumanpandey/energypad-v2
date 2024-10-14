import { DB } from '@lib';
import Decimal from 'decimal.js';
import { formatISO, setDate, setMonth, subMonths } from 'date-fns';
import { AppModels, RequestBodyParams, Transactionable } from '@types';
import { DbUtils, MathUtils, UnitsUtil } from '@utils';
import SiteService from './sites.service';
import { ProducedConsumption } from './dashboard.service';
import { capitalizeFirstLetter } from '../utils/appUtils';
import { ulid } from 'ulid';
import * as flatCache from 'flat-cache';
import { UtilityService } from '@services';

export type SupportedUses = 'Heating' | 'Cooling' | 'Powering' | 'Lighting';

export type AddConsumptionToUtilityParam = RequestBodyParams<'AddFuelSourceConsumption'>;
export const addConsumptionToUtility = async (params: AddConsumptionToUtilityParam, opt?: Transactionable) => {
  const driver = opt?.txr || DB;

  const consumptions: Record<string, any>[] = [];
  for (let i = 0; i < params.length; i++) {
    const { usedInId, consumption, conversionFactor, fuelUnit, ...data } = params[i];

    const id = ulid();
    const unit = fuelUnit as UnitsUtil.ONE_OF_SUPPORTED_UNIT;
    consumptions.push({
      ...data,
      id,
      consumption: UnitsUtil.resolveConsumptionToKwh({ consumption, conversionFactor, fuelUnit: unit }),
      conversionFactor,
      fuelUnit,
      usedInId,
    });
  }

  await driver('UtilityConsumptions').insert(consumptions);
};

export const areConsumptionEqual =
  (record: { siteId: number; fuelSourceId: number; date: string; usedInId: number }) =>
  (r: { siteId: number; fuelSourceId: number; date: string; usedInId: number }) =>
    r.date === record.date &&
    r.siteId === record.siteId &&
    r.fuelSourceId === record.fuelSourceId &&
    r.usedInId === record.usedInId;
export const upsertConsumptionToUtility = async (
  params: Array<RequestBodyParams<'AddFuelSourceConsumption'>[0] & { id: null | undefined | number }>,
  opt: { txr: NonNullable<Transactionable['txr']> },
) => {
  const driver = opt.txr;

  const existingRecords = await driver('UtilityConsumptions')
    .select('*')
    .whereIn('siteId', Array.from(new Set(params.map((r) => r.siteId))))
    .andWhere('fuelSourceId', 'in', Array.from(new Set(params.map((r) => r.fuelSourceId))))
    .andWhere('date', 'in', Array.from(new Set(params.map((r) => r.date))));

  const records = [];
  for (let i = 0; i < params.length; i++) {
    let record = params[i];
    const foundToUpdate = existingRecords.findIndex(areConsumptionEqual(record));

    if (foundToUpdate > -1) {
      const found = existingRecords[foundToUpdate];
      found.usedInId = record.usedInId;
      found.consumption = record.consumption;
      found.fuelUnit = record.fuelUnit;
      found.totalCost = record.totalCost;
      found.vat = record.vat;
      found.usedInId = record.usedInId;
      record = found;
    }
    records.push(record);
  }

  const newData = records.filter((r) => r.id === null || r.id === undefined);
  if (newData.length > 0) {
    const c = [];
    for (let i = 0; i < newData.length; i++) {
      const id = ulid();
      c.push({ ...newData[i], id });
    }
    if (c.length !== 0) {
      await driver('UtilityConsumptions').insert(c);
    }
  }
  const upsertData = records.filter((r) => r.id !== null && r.id !== undefined);
  if (upsertData.length > 0) {
    await driver('UtilityConsumptions')
      .insert(upsertData)
      .onConflict('id')
      .merge(['vat', 'totalCost', 'consumption', 'fuelUnit', 'usedInId']);
  }

  return [];
};

export const upsertEmissions = async (
  params: Array<RequestBodyParams<'AddFuelSourceConsumption'>[0] & { id: null | undefined | number }>,
  opt?: Transactionable,
) => {
  const driver = opt?.txr || DB;

  const existingRecords = await driver('UtilityEmissions')
    .select('*')
    .whereIn('siteId', Array.from(new Set(params.map((r) => r.siteId))))
    .andWhere('fuelSourceId', 'in', Array.from(new Set(params.map((r) => r.fuelSourceId))))
    .andWhere('date', 'in', Array.from(new Set(params.map((r) => r.date))));

  const records = [];
  for (let i = 0; i < params.length; i++) {
    let record = params[i];
    const foundToUpdate = existingRecords.findIndex(
      (r) => r.date === record.date && r.fuelSourceId === record.fuelSourceId && r.siteId === record.siteId,
    );

    if (foundToUpdate > -1) {
      const found = existingRecords[foundToUpdate];
      existingRecords.splice(foundToUpdate, 1);
      record = found;
    }

    records.push(record);
  }

  const newData = records.filter((r) => r.id === null || r.id === undefined);
  if (newData.length != 0) {
    await driver('UtilityEmissions').insert(newData);
  }
  const upsertData = records.filter((r) => r.id !== null && r.id !== undefined);
  if (upsertData.length > 0) {
    const withConversionFactor = upsertData.filter((d) => d.conversionFactor);
    if (withConversionFactor.length !== 0) {
      await driver('UtilityEmissions')
        .insert(upsertData)
        .onConflict('id')
        .merge(['conversionFactor', 'fuelUnit', 'emissionFactor']);
    }
  }

  return [];
};

export const upsertMonitoring = async (
  params: Array<RequestBodyParams<'AddFuelSourceConsumption'>[0] & { id: null | undefined | number }>,
  opt?: Transactionable,
) => {
  const driver = opt?.txr || DB;

  const existingRecords = await driver('UtilityMonitoring')
    .select('*')
    .whereIn('siteId', Array.from(new Set(params.map((r) => r.siteId))))
    .andWhere('fuelSourceId', 'in', Array.from(new Set(params.map((r) => r.fuelSourceId))))
    .andWhere('date', 'in', Array.from(new Set(params.map((r) => r.date))));

  const records = [];
  for (let i = 0; i < params.length; i++) {
    let record = params[i];
    const foundToUpdate = existingRecords.findIndex(
      (r) => r.date === record.date && r.fuelSourceId === record.fuelSourceId,
    );

    if (foundToUpdate > -1) {
      const found = existingRecords[foundToUpdate];
      existingRecords.splice(foundToUpdate, 1);
      found.conversionFactor = record.conversionFactor;
      record = found;
    }

    records.push(record);
  }

  const removeUsedIn = (n: Record<string, string | number | number[] | undefined | null>) => {
    const { usedInId, ...r } = n;
    return r;
  };
  const newData = records.filter((r) => r.id === null || r.id === undefined);
  if (newData.length > 0) {
    await driver('UtilityMonitoring').insert(newData.map(removeUsedIn));
  }
  const upsertData = records.filter((r) => r.id !== null && r.id !== undefined);
  if (upsertData.length > 0) {
    await driver('UtilityMonitoring')
      .insert(upsertData.map(removeUsedIn))
      .onConflict('id')
      .merge(['energy', 'carbon', 'conversionFactor', 'fuelUnit']);
  }

  return [];
};

export const addMonitoringToUtility = async (
  params: RequestBodyParams<'AddFuelSourceMonitoring'>,
  opt?: Transactionable,
) => {
  const driver = opt?.txr || DB;
  const promises = params.map(async (record) => {
    const { usedInId, ...data } = record;

    const [r] = await driver('UtilityMonitoring').insert(data).returning('id');
    if (usedInId.length !== 0) {
      const usesData = usedInId.map((u) => ({ monitoringId: r.id, usedInId: u }));
      await driver('UtilityMonitoringToUseInId').insert(usesData);
    }
  });

  return Promise.all(promises);
};

export type GetMonitoringParams = { siteId?: number | number[]; year?: number; month?: number; businessId?: number };
export const getMonitoring = (params: GetMonitoringParams): Promise<AppModels['ConsumptionTarget'][]> => {
  const query = DB('UtilityMonitoring')
    .select(['UtilityMonitoring.*'])
    .innerJoin('FuelSources', 'UtilityMonitoring.fuelSourceId', 'FuelSources.id')
    .innerJoin({ S: 'Sites' }, 'UtilityMonitoring.siteId', 'S.id')
    .innerJoin({ B: 'Businesses' }, 'S.businessId', 'B.id');

  if (params.businessId) {
    query.where('B.id', params.businessId);
  }
  if (params.year !== undefined && params.month !== undefined) {
    query.where(
      'UtilityMonitoring.date',
      'like',
      `${params.year}-${new Date(Date.UTC(params.year, params.month, 1)).toISOString().split('T')[0].split('-')[1]}-%`,
    );
  }
  if (params?.siteId) {
    if (Array.isArray(params.siteId)) {
      query.whereIn('UtilityMonitoring.siteId', params.siteId);
    } else {
      query.where('UtilityMonitoring.siteId', params.siteId);
    }
  }
  return query;
};

export const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
};

export const mapEnergyTipToBusiness = (p: { businessId: number; tipId: number[]; month: number; use: string }) => {
  const query = DB('EnergySavingTipsToBusiness').insert(p.tipId.map((i) => ({ ...p, tipId: i })));
  return query;
};

export const getBusinessTips = (p: { businessId: number; month?: number; use?: string; siteId: number }) => {
  const query = DB('EnergySavingTipsToBusiness').select().where('businessId', p.businessId);

  if (p.month !== undefined) {
    query.where('month', p.month);
  }

  if (p.siteId !== undefined) {
    query.where('siteId', p.month);
  }

  if (p.use !== undefined) {
    if (Array.isArray(p.use)) {
      query.whereIn('use', p.use);
    } else {
      query.where('use', p.use);
    }
  }

  return query;
};

type DeleteEmissionByParams = {
  siteId?: number | number[];
  date?: string | string[];
  fuelSourceId?: number | number[];
};
export const deleteEmissionsBy = (p: DeleteEmissionByParams, opt?: Transactionable) => {
  const query = DB('UtilityEmissions').delete();

  if (p.date) {
    if (Array.isArray(p.date)) {
      const years = Array.from(new Set(p.date.map((i) => i.split('-')[0])).values());
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        query.orWhere('date', year + '%');
      }
    } else {
      query.where('date', 'like', p.date.split('-')[0] + '%');
    }
  }

  if (p.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('fuelSourceId', Array.from(new Set(p.fuelSourceId).values()));
    } else {
      query.where('fuelSourceId', p.fuelSourceId);
    }
  }
  if (p.siteId) {
    if (Array.isArray(p.siteId)) {
      query.whereIn('siteId', Array.from(new Set(p.siteId).values()));
    } else {
      query.where('siteId', p.siteId);
    }
  }
  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query.del();
};

type DeleteConsumptionByParams = {
  month?: Date | Date[];
  fuelSourceId?: number | number[];
  siteId?: number | number[];
};
export const deleteConsumptionBy = (p: DeleteConsumptionByParams) => {
  const query = DB('UtilityConsumptions').delete();

  if (p.month) {
    if (Array.isArray(p.month)) {
      const dates = Array.from(new Set(p.month.sort(DbUtils.sortByDate)).values());
      query.where((q) => {
        const asignDate = (i: string) => q.orWhere('date', i);
        dates.map(DbUtils.dateToStringDate).map(asignDate);
      });
    } else {
      const [year, month] = formatISO(p.month).split('T')[0].split('-');
      query.where('date', 'like', `${year}-${month}%`);
    }
  }

  if (p.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('fuelSourceId', Array.from(new Set(p.fuelSourceId).values()));
    } else {
      query.where('fuelSourceId', p.fuelSourceId);
    }
  }
  if (p.siteId) {
    if (Array.isArray(p.siteId)) {
      query.whereIn('siteId', Array.from(new Set(p.siteId).values()));
    } else {
      query.where('siteId', p.siteId);
    }
  }
  return query.del();
};

export type GetEmissionsParams = {
  businessId: number;
  forYear?: Date;
  siteId?: number | number[];
  fuelSourceId?: number | number[];
};
export const getEmissions = (params: GetEmissionsParams): Promise<AppModels['UtilityEmission'][]> => {
  const query = DB('UtilityEmissions')
    .select(['UtilityEmissions.*', { fuelSourceId: 'FuelSources.id' }])
    .innerJoin('FuelSources', 'UtilityEmissions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ S: 'Sites' }, 'UtilityEmissions.siteId', 'S.id')
    .innerJoin({ B: 'Businesses' }, 'S.businessId', 'B.id')
    .where('B.id', params.businessId);

  if (params.siteId) {
    if (Array.isArray(params.siteId)) {
      query.whereIn('UtilityEmissions.siteId', params.siteId);
    } else {
      query.where('UtilityEmissions.siteId', params.siteId);
    }
  }

  if (params.forYear) {
    query.where('UtilityEmissions.date', 'like', params.forYear.getFullYear() + '%');
  }

  if (params.fuelSourceId) {
    if (Array.isArray(params.fuelSourceId)) {
      query.whereIn('UtilityEmissions.fuelSourceId', params.fuelSourceId);
    } else {
      query.where('UtilityEmissions.fuelSourceId', params.fuelSourceId);
    }
  }

  return query;
};

export type GetConsumptionsParams = {
  businessId: number;
  forMonth?: Date;
  forYear?: Date;
  startDate?: Date;
  endDate?: Date;
  fuelSourceId?: number | number[];
  siteId?: number | number[];
};
export const getConsumptions = async (params: GetConsumptionsParams): Promise<AppModels['UtilityConsumption'][]> => {
  const fields = [
    'UtilityConsumptions.*',
    { fuelSourceId: 'FuelSources.id' },
    { fuelSourceName: 'FuelSources.source' },
    { siteId: 'S.id' },
    { siteName: 'S.name' },
  ];

  const query = DB('UtilityConsumptions')
    .select(fields)
    .innerJoin('FuelSources', 'UtilityConsumptions.fuelSourceId', 'FuelSources.id')
    .innerJoin({ S: 'Sites' }, 'UtilityConsumptions.siteId', 'S.id')
    .innerJoin({ B: 'Businesses' }, 'S.businessId', 'B.id')
    .where('B.id', params.businessId);

  if (params.startDate) {
    const dateParam: string = formatISO(params.startDate).split('T')[0];
    query.where('UtilityConsumptions.date', '>=', dateParam);
  }

  if (params.endDate) {
    const dateParam: string = formatISO(params.endDate).split('T')[0];
    query.where('UtilityConsumptions.date', '<=', dateParam);
  }

  if (params.forMonth) {
    const dateParam: string = formatISO(params.forMonth).split('T')[0];
    query.where('UtilityConsumptions.date', 'like', `%-${dateParam.slice(5, 7)}-%`);
  }

  if (params.forYear) {
    const dateParam: string = formatISO(params.forYear).split('T')[0];
    query.where('UtilityConsumptions.date', 'like', dateParam.slice(0, 4) + '-%');
  }

  if (params.fuelSourceId) {
    if (Array.isArray(params.fuelSourceId)) {
      query.whereIn('FuelSources.id', params.fuelSourceId);
    } else {
      query.where('FuelSources.id', params.fuelSourceId);
    }
  }

  if (params.siteId) {
    if (Array.isArray(params.siteId)) {
      query.whereIn('UtilityConsumptions.siteId', params.siteId);
    } else {
      query.where('UtilityConsumptions.siteId', params.siteId);
    }
  }
  const records = await query;
  const table = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const found = table.get(r.id);
    if (found) {
      const { usedInId } = r;
      found.usedInId.push(usedInId);
      table.set(r.id, found);
    } else {
      table.set(r.id, r);
    }
  }
  const consumptions = Array.from(table.values());
  return consumptions;
};

export type FuelSource = AppModels['FuelSource'] & { id: number };
export const getFuelSources = async (p?: { id?: number | number[] }): Promise<FuelSource[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  if (p?.id) {
    if (Array.isArray(p.id)) {
      query.whereIn('id', p.id);
    } else {
      query.where('id', p.id);
    }
  }
  const records = await query;

  return records;
};

type FindFuelByParams = {
  fuelSourceId?: number | number[];
  names?: string | string[];
};
export const findFuelBy = async (p?: FindFuelByParams): Promise<AppModels['FuelSource'][]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  if (p?.fuelSourceId) {
    if (Array.isArray(p.fuelSourceId)) {
      query.whereIn('FuelSources.id', p.fuelSourceId);
    } else {
      query.where('FuelSources.id', p.fuelSourceId);
    }
  }

  if (p?.names) {
    if (Array.isArray(p.names)) {
      query.whereIn('source', p.names);
    } else {
      query.where('source', p.names);
    }
  }

  const records = await query;

  return records;
};

type FindFuelUseByParams = {
  id?: number | number[];
  names?: string | string[];
};
export const findFuelUseBy = async (p?: FindFuelUseByParams): Promise<AppModels['FuelUse'][]> => {
  const query = DB('FuelUses').select('FuelUses.*');

  if (p?.id) {
    if (Array.isArray(p.id)) {
      query.whereIn('id', p.id);
    } else {
      query.where('id', p.id);
    }
  }

  if (p?.names) {
    if (Array.isArray(p.names)) {
      query.whereIn('use', p.names.map(capitalizeFirstLetter));
    } else {
      query.where('use', capitalizeFirstLetter(p.names));
    }
  }
  const records = await query;

  return records;
};

export const addUtilityEmissions = (p: Omit<AppModels['UtilityEmission'], 'id'>[], opt?: Transactionable) => {
  const driver = opt?.txr || DB;
  const promises = p.map(async (i) => {
    const [record] = await driver('UtilityEmissions').insert(i).returning('id');

    return record.id;
  });

  return Promise.all(promises);
};

export type ConsummingStaticsticsParams = {
  currentConsumptionRecords: ProducedConsumption[];
  year: number;
};

export type Projection = {
  date: string;
  consumption: number;
  projectedEnergy: number;
  saving: number;
  siteId: number;
  produced: boolean | undefined;
};
export const consumingProjection = async (p: ConsummingStaticsticsParams): Promise<Projection[][]> => {
  const sitesId = Array.from(new Set(p.currentConsumptionRecords.map((i) => i.siteId)).values());
  const fuelSourcesId = Array.from(new Set(p.currentConsumptionRecords.map((i) => i.fuelSourceId)).values());
  const targetData = await getMonitoring({ siteId: sitesId });

  const mapMonthRecord = new Map();
  for (let fuelIdx = 0; fuelIdx < fuelSourcesId.length; fuelIdx++) {
    for (let siteIdx = 0; siteIdx < sitesId.length; siteIdx++) {
      const fuelSourceId = fuelSourcesId[fuelIdx];
      const siteId = sitesId[siteIdx];

      const currentSiteConsumptions = p.currentConsumptionRecords
        .filter(SiteService.filterBySiteId(siteId))
        .filter(UtilityService.filterByFuelSource(fuelSourceId));

      for (let idx = 1; idx < currentSiteConsumptions.length; idx++) {
        const thisConsumption = currentSiteConsumptions.find((c) => {
          const d = DbUtils.stringDateToDate(c.date);
          return d.getMonth() === idx - 1 && d.getFullYear() === p.year;
        });
        if (!thisConsumption) {
          break;
        }

        const projetion = targetData.find(
          (i) =>
            i.date === thisConsumption.date &&
            i.siteId === thisConsumption.siteId &&
            i.fuelSourceId === thisConsumption.fuelSourceId,
        );

        const previouseProjection = projetion
          ? targetData.find(
              (i) =>
                i.date === DbUtils.dateToStringDate(subMonths(DbUtils.stringDateToDate(projetion.date), 1)) &&
                i.siteId === projetion.siteId &&
                i.fuelSourceId === projetion.fuelSourceId,
            )
          : undefined;

        const projectedEnergy = projetion ? projetion.energy : 0;

        const r = {
          produced: thisConsumption.produced,
          fuelSourceName: thisConsumption.fuelSourceName,
          fuelSourceId: thisConsumption.fuelSourceId,
          siteId: thisConsumption.siteId,
          siteName: thisConsumption.siteName,
          date: thisConsumption
            ? thisConsumption.date
            : DbUtils.dateToStringDate(setDate(setMonth(new Date(), idx - 1), 1)),
          consumption: thisConsumption.consumption,
          projectedEnergy: projectedEnergy,
          saving: new Decimal(projectedEnergy).minus(thisConsumption ? thisConsumption.consumption : 0).toNumber(),
          increasedPercentage:
            !previouseProjection || previouseProjection?.energy === 0
              ? 0
              : MathUtils.calculateIncreasePercentage({
                  currentValue: projectedEnergy || 0,
                  passValue: previouseProjection?.energy || 0,
                }),
        };
        const found = mapMonthRecord.get(idx.toString());
        if (found) {
          found.push(r);
          mapMonthRecord.set(idx.toString(), found);
        } else {
          mapMonthRecord.set(idx.toString(), [r]);
        }
      }
    }
  }

  const reducedData = Array.from(mapMonthRecord.values());
  return reducedData;
};

export const filterByFuelSource = (i: number) => (r: { fuelSourceId: number }) => {
  return i === r.fuelSourceId;
};

/**
 * The following function caches the records of the FuelUses table
 * in order to not query the DB each time.
 * This functions assumes the records on the table will never be changed or updated
 * and if do so the app needs to be restarted to clear cache and update the values on it
 **/
const usedInCache = flatCache.load('usedIn');
export const isOnUse = async (p: { usedInId: number | number[]; use: SupportedUses }) => {
  if (p.usedInId === 0) {
    return false;
  }
  let usedInFound = [usedInCache.getKey(p.usedInId.toString())];
  if (Array.isArray(p.usedInId)) {
    usedInFound = p.usedInId.map((i) => usedInCache.getKey(i.toString()));
  }

  if (usedInFound.some((i) => i === undefined)) {
    const usesIn = await DB<{ id: number; use: string }>('FuelUses').select();
    for (let i = 0; i < usesIn.length; i++) {
      const useIn = usesIn[i];
      usedInCache.setKey(useIn.id.toString(), useIn);
      if (Array.isArray(p.usedInId)) {
        if (p.usedInId.includes(useIn.id)) {
          usedInFound = [useIn];
        }
      } else {
        if (p.usedInId === useIn.id) {
          usedInFound = [useIn];
        }
      }
    }
    usedInCache.save();
  }
  return usedInFound.some((i) => i.use === p.use);
};
