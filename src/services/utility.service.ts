import { DB } from '@lib';
import Decimal from 'decimal.js';
import { formatISO, setDay, setMonth } from 'date-fns';
import { AppModels, RequestBodyParams, Transactionable } from '@types';
import { DbUtils } from '@utils';
import SiteService from './sites.service';
import { ProducedConsumption } from './dashboard.service';
import { capitalizeFirstLetter } from '../utils/appUtils';

export type AddConsumptionToUtilityParam = RequestBodyParams<'AddFuelSourceConsumption'>;
export const addConsumptionToUtility = async (params: AddConsumptionToUtilityParam, opt?: Transactionable) => {
  const query = DB('UtilityConsumptions').insert(params);

  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query;
};

export const getSavingTips = (): Promise<AppModels['SavingTip'][]> => {
  const query = DB('EnergySavingTips').select();

  return query;
};

type DeleteEmissionByParams = {
  siteId?: number | number[];
  year?: number | number[];
  fuelSourceId?: number | number[];
};
export const deleteEmissionsBy = (p: DeleteEmissionByParams, opt?: Transactionable) => {
  const query = DB('UtilityEmissions').delete();

  if (p.year) {
    if (Array.isArray(p.year)) {
      const years = Array.from(new Set(p.year).values());
      query.whereIn('year', years);
    } else {
      query.where('year', p.year);
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
    query.where('UtilityEmissions.year', params.forYear.getFullYear());
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
export const getConsumptions = (params: GetConsumptionsParams): Promise<AppModels['UtilityConsumption'][]> => {
  const fields = [
    'UtilityConsumptions.*',
    { fuelSourceId: 'FuelSources.id' },
    { fuelSourceName: 'FuelSources.source' },
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

  return query;
};

export type FuelSource = AppModels['FuelSource'] & { id: number };
export const getFuelSources = async (): Promise<FuelSource[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  const records = await query;

  return records;
};

type FindFuelByParams = {
  fuelSourceId?: number | number[];
  names?: string | string[];
};
export const findFuelBy = (p: FindFuelByParams): Promise<{ id: number; source: string }[]> => {
  const query = DB('FuelSources').select('FuelSources.*');

  if (p.fuelSourceId) {
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

  return query;
};

type FindFuelUseByParams = {
  id?: number | number[];
  names?: string | string[];
};
export const findFuelUseBy = (p?: FindFuelUseByParams): Promise<{ id: number; use: string }[]> => {
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

  return query;
};

export const addUtilityEmissions = (p: Omit<AppModels['UtilityEmission'], 'id'>[], opt?: Transactionable) => {
  const query = DB('UtilityEmissions').insert(p);
  if (opt?.txr) {
    query.transacting(opt.txr);
  }
  return query;
};

type Hdd = { date: Date; value: number };
type ConsummingStaticsticsParams = {
  pastConsumptionRecords: ProducedConsumption[];
  currentConsumptionRecords: ProducedConsumption[];
  pastHdds: Hdd[];
  currentHdd: Hdd[];
};

const NX = 6;

export const consumingProjection = async (p: ConsummingStaticsticsParams) => {
  const patterns = p.pastConsumptionRecords;

  const totalOfHdd = p.pastHdds.reduce((total, next) => new Decimal(total).plus(next.value).toNumber(), 0);
  const totalOfConsumption = patterns.reduce((total, next) => new Decimal(total).plus(next.consumption).toNumber(), 0);
  const totalOfHddPower = p.pastHdds.reduce(
    (total, next) => new Decimal(next.value).times(next.value).plus(total).toNumber(),
    0,
  );

  const hddPerEnergy = patterns.map((item, idx) =>
    new Decimal(p.pastHdds[idx] ? p.pastHdds[idx].value : 0).times(item.consumption).toNumber(),
  );

  const totalOfHddPerEnergy = hddPerEnergy.reduce((total, next) => new Decimal(total).plus(next).toNumber(), 0);

  const a9Top = new Decimal(new Decimal(totalOfConsumption).times(totalOfHddPower))
    .minus(new Decimal(totalOfHdd).times(totalOfHddPerEnergy))
    .toNumber();

  const b9Top = new Decimal(new Decimal(NX).times(totalOfHddPerEnergy))
    .minus(new Decimal(totalOfHdd).times(totalOfConsumption))
    .toNumber();
  const belowVal = new Decimal(new Decimal(NX).times(totalOfHddPower))
    .minus(new Decimal(totalOfHdd).times(totalOfHdd))
    .toNumber();

  const intercept = new Decimal(a9Top).dividedBy(belowVal).toDecimalPlaces(8).toNumber();
  const slope = new Decimal(b9Top).dividedBy(belowVal).toDecimalPlaces(8).toNumber();

  const reducedData = [];

  const sitesId = Array.from(new Set(p.currentConsumptionRecords.map((i) => i.siteId)).values());

  for (let s = 0; s < sitesId.length; s++) {
    const siteId = sitesId[s];

    const currentSiteConsumptions = p.currentConsumptionRecords.filter(SiteService.filterBySiteId(siteId));

    for (let idx = 1, len = currentSiteConsumptions.length; idx < len; idx++) {
      const thisConsumption = currentSiteConsumptions[idx];
      const item = p.currentHdd[idx];
      let projectedEnergy = 0;
      if (!thisConsumption?.produced) {
        const s = new Decimal(item.value).times(slope).toNumber();
        projectedEnergy = new Decimal(intercept).plus(s).toNumber();
      }

      reducedData.push({
        fuelSourceName: thisConsumption.fuelSourceName,
        fuelSourceId: thisConsumption.fuelSourceId,
        siteId: thisConsumption.siteId,
        date: DbUtils.dateToStringDate(item?.date || setDay(setMonth(new Date(), idx), 1)),
        consumption: thisConsumption.consumption,
        //hdd: i.value,
        //slope: s,
        projectedEnergy: projectedEnergy,
        saving: new Decimal(projectedEnergy).minus(thisConsumption ? thisConsumption.consumption : 0).toNumber(),
      });
    }
  }

  return reducedData;
};

export type Projection = Awaited<ReturnType<typeof consumingProjection>>;

export const filterByFuelSource = (i: number) => (r: { fuelSourceId: number }) => {
  return i === r.fuelSourceId;
};
