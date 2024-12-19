import { DB } from '@lib';
import { AppModels, RequestBodyParams, RequestBodies, RequestResponses } from '@types';
import userService from './user.service';

const createSite = async (params: RequestBodyParams<'SiteUpdate'> | RequestBodyParams<'Site'>) => {
  const { id, ...vals } = params;
  if (id) {
    const r = vals;
    return DB('Sites').update(r).where('id', id).returning('*');
  } else {
    return (await DB('Sites').insert(vals).returning('id'))[0].id;
  }
};

const getSiteDetails = async (params: { id: number }): Promise<RequestResponses<'GetSiteDetails'> | null> => {
  const query = DB('Sites')
    .select([
      { 'S-id': 'Sites.id' },
      { 'S-type': 'Sites.type' },
      { 'S-address': 'Sites.address' },
      { 'S-postCode': 'Sites.postCode' },
      { 'S-town': 'Sites.town' },
      { 'S-population': 'Sites.population' },
      { 'S-size': 'Sites.size' },

      { 'P-id': 'P.id' },
      { 'P-question': 'P.question' },
      { 'P-usedInId': 'P.usedInId' },

      { 'PA-id': 'PA.id' },
      { 'PA-answer': 'PA.answer' },
      { 'PA-programmeId': 'PA.programmeId' },

      { 'R-id': 'R.id' },
      { 'R-question': 'R.question' },

      { 'RA-id': 'RA.id' },
      { 'RA-answer': 'RA.answer' },
      { 'RA-reviewId': 'RA.reviewId' },

      { 'BT-id': 'BT.id' },
      { 'BT-date': 'BT.date' },
      { 'BT-regularTenantAmount': 'BT.regularTenantAmount' },
      { 'BT-irregularTenantAmount': 'BT.irregularTenantAmount' },
      { 'BT-usedInId': 'BT.usedInId' },

      { 'BL-id': 'BL.id' },
      { 'BL-startDate': 'BL.startDate' },
      { 'BL-endDate': 'BL.endDate' },
      { 'BL-comments': 'BL.comments' },
      { 'BL-operation': 'BL.operation' },
      { 'BL-usedInId': 'BL.usedInId' },
    ])
    .where('Sites.id', params.id)
    .leftJoin({ P: 'Programmes' }, 'Sites.id', 'P.siteId')
    .leftJoin({ PA: 'ProgrammeAnswers' }, 'P.id', 'PA.programmeId')
    .leftJoin({ R: 'Reviews' }, 'Sites.id', 'R.siteId')
    .leftJoin({ RA: 'ReviewsAnswers' }, 'R.id', 'RA.reviewId')
    .leftJoin({ BT: 'BusinessTenant' }, 'Sites.id', 'BT.siteId')
    .leftJoin({ BL: 'BusinessLog' }, 'Sites.id', 'BL.siteId');

  const [records, energies] = await Promise.all([
    query,
    userService.getBusinessEnergies<AppModels['BusinessEnergy']>({ siteId: params.id }),
  ]);

  if (records.length === 0) {
    return null;
  }
  const record: {
    programmes: AppModels['Programme'][];
    reviews: AppModels['Review'][];
    tenants: AppModels['Tenant'][];
    logs: AppModels['EnergyLog'][];
    energies: AppModels['BusinessEnergy'][];
  } = {
    programmes: [],
    reviews: [],
    tenants: [],
    logs: [],
    energies: [],
  };

  const programmesMap = new Map();
  const reviewsMap = new Map();
  const logsMap = new Map();
  const tenantMap = new Map();

  for (let i = 0, len = records.length; i < len; i++) {
    const el = records[i];

    if (el['P-id']) {
      const reviewFound = programmesMap.get(el['P-id']);
      if (reviewFound && el['P-id'] === el['PA-programmeId']) {
        reviewFound.answers.push(el['PA-answer']);
        reviewFound.answers = Array.from(new Set(reviewFound.answers).values());
        programmesMap.set(el['P-id'], reviewFound);
      } else {
        programmesMap.set(el['P-id'], {
          question: el['P-question'],
          siteId: el['S-id'],
          usedInId: el['P-usedInId'],
          answers: [],
        });
      }
    }

    if (el['R-id']) {
      const reviewFound = reviewsMap.get(el['R-id']);
      if (reviewFound && el['R-id'] === el['RA-reviewId']) {
        reviewFound.answers.push(el['RA-answer']);
        reviewFound.answers = Array.from(new Set(reviewFound.answers).values());
        reviewsMap.set(el['R-id'], reviewFound);
      } else {
        reviewsMap.set(el['R-id'], {
          question: el['R-question'],
          siteId: el['S-id'],
          answers: [],
        });
      }
    }

    if (el['BL-id']) {
      logsMap.set(el['BL-id'], {
        startDate: el['BL-startDate'],
        endDate: el['BL-endDate'],
        comments: el['BL-comments'],
        operation: el['BL-operation'],
        siteId: el['S-id'],
        usedInId: el['BL-usedInId'],
      });
    }

    if (el['BT-id']) {
      tenantMap.set(el['BT-id'], {
        date: el['BT-date'],
        regularTenantAmount: el['BT-regularTenantAmount'],
        irregularTenantAmount: el['BT-irregularTenantAmount'],
        siteId: el['S-id'],
        usedInId: el['BT-usedInId'],
      });
    }
  }

  record.energies = energies;
  record.programmes = Array.from(programmesMap.values());
  record.reviews = Array.from(reviewsMap.values());
  record.logs = Array.from(logsMap.values());
  record.tenants = Array.from(tenantMap.values());

  return record;
};

export type FindByParams = {
  id?: number | number[];
  name?: string | string[];
  codes?: string | string[];
  businessId?: number;
  fuelSourceIdUsedInConsumption?: number;
  includeUse?: boolean;
};
const findBy = async (params?: FindByParams): Promise<(Omit<AppModels['Site'], 'id'> & { id: number })[]> => {
  const includeUse = params?.fuelSourceIdUsedInConsumption && params.includeUse === true;
  const fields: ( string | Record<string, string> )[] = ['Sites.*'];
  if (includeUse) {
    fields.push({ 'FU.id': 'useId' });
  }
  const query = DB('Sites').select(fields);
  if (params?.id) {
    Array.isArray(params.id) ? query.whereIn('id', params.id) : query.where('id', params.id);
  }

  if (params?.name) {
    Array.isArray(params.name) ? query.whereIn('name', params.name) : query.where('name', params.name);
  }
  if (params?.codes) {
    Array.isArray(params.codes) ? query.whereIn('code', params.codes) : query.where('code', params.codes);
  }

  if (params?.businessId) {
    query.where('businessId', params.businessId);
  }

  if (params?.fuelSourceIdUsedInConsumption) {
    const fsi = params.fuelSourceIdUsedInConsumption;
    query
      .leftJoin({ UC: 'UtilityConsumptions' }, function () {
        this.on('Sites.id', '=', 'UC.siteId').onVal('UC.fuelSourceId', '=', fsi);
      })
      .groupBy('Sites.id');
  }

  if (includeUse) {
    query.leftJoin({ FU: 'FuelUse' }, 'UC.usedInId', 'FU.id');
  }

  return query;
};

const deleteById = async (params: { id: number }) => {
  return DB('Sites').where('id', params.id).del();
};

const getCountries = async () => {
  return DB('Countries').select();
};

type GetStatesParams = {
  countryId?: number;
};
const getStates = async (p?: GetStatesParams) => {
  const query = DB('States').select();

  if (p?.countryId) {
    query.where('countryId', p.countryId);
  }
  return query;
};

const filterBySiteId = (id: number) => (s: { siteId: number }) => {
  return id === s.siteId;
};

const setSiteConversionUnits = async (p: RequestBodies['SetSiteConversionUnit']['content']['application/json']) => {
  return DB('SiteConversionUnits').insert(p);
};

export default {
  findBy,
  createSite,
  deleteById,
  getSiteDetails,
  getCountries,
  getStates,
  filterBySiteId,
  setSiteConversionUnits,
};
