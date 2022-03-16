import { DB } from '@lib';
import { getSinglePropArr } from '@utils';
import { AppModels, RequestBodies, Transactionable } from '@types';
import { formatISO } from 'date-fns';

const getUserBy = async (params: { id?: number; email?: string }) => {
  const query = DB('Businesses')
    .select([
      'Businesses.*',
      'Programmes.id as ProgrammeId',
      'Programmes.question',
      'ProgrammeAnswers.answer',
      { FloorId: 'Floors.id' },
      { FloorSize: 'Floors.size' },
      { FloorArea: 'Floors.area' },
      { FloorPopulation: 'Floors.population' },
    ])
    .leftJoin('Utilities', 'Businesses.id', 'Utilities.businessId')
    .leftJoin({ B: 'Businesses' }, 'Utilities.businessId', 'B.id')
    .leftJoin('Sites', 'B.id', 'Sites.businessId')
    .leftJoin('Programmes', 'Sites.id', 'Programmes.siteId')
    .leftJoin('ProgrammeAnswers', 'Programmes.id', 'ProgrammeAnswers.programmeId')
    .leftJoin('Floors', 'Businesses.id', 'Floors.businessId');

  if (params.id) {
    query.where({ 'Businesses.id': params.id });
  }
  if (params.email) {
    query.where({ 'Businesses.email': params.email });
  }

  const records = await query;
  const reduceRecords = (r: any[]) => {
    const programmes = new Map();
    const floors = new Map();

    for (let i = 0, len = r.length; i < len; i++) {
      const el = r[i];

      if (el.ProgrammeId && programmes.has(el.ProgrammeId) === false) {
        programmes.set(el.ProgrammeId, { id: el.ProgrammeId, question: el.question, answers: [el.answer] });
      } else if (el.ProgrammeId && programmes.has(el.ProgrammeId) === true) {
        const programme = programmes.get(el.ProgrammeId);
        programme.answers.push(el.answer);
        programmes.set(el.ProgrammeId, programme);
      }

      if (el.FloorId && floors.has(el.FloorId) === false) {
        floors.set(el.FloorId, {
          size: el.FloorSize,
          area: el.FloorArea,
          population: el.FloorPopulation,
        });
      } else if (el.FloorId && floors.has(el.FloorId) === true) {
        const programme = floors.get(el.FloorId);
        floors.set(el.FloorId, programme);
      }
    }
    if (!r[0]) return undefined;

    const { question, ProgrammeId, FloorSize, FloorPopulation, FloorId, FloorArea, answer, ...first } = r[0];
    if (first) {
      first.programmes = Array.from(programmes.values()) || [];
      first.floors = Array.from(floors.values()) || [];
    }
    return first;
  };
  const record = reduceRecords(records);
  return record;
};

export type AddServiceParams = { businessId: number; patterns: AppModels['BusinessPattern'][] };
const savePattern = async (params: AddServiceParams, opt?: Transactionable) => {
  const data = [];

  for (let i = 0, len = params.patterns.length; i < len; i++) {
    const element = params.patterns[i];
    data.push({
      siteId: element.siteId,
      usedInId: element.usedInId,
      startDate: element.startDate,
      endDate: element.endDate,
      consumption: element.consumption,
      daysOnYear: element.daysOnYear,
    });
  }

  const query = DB('BusinessPatterns').insert(data);
  if (opt?.txr) {
    query.transacting(opt.txr);
  }

  return query;
};

type GetPatternsParams = {
  startDate?: Date;
  endDate?: Date;
  businessId: number;
};
export const getPatterns = (p: GetPatternsParams) => {
  const query = DB('BusinessPatterns')
    .select('BusinessPatterns.*')
    .innerJoin({ S: 'Sites' }, 'BusinessPatterns.siteId', 'S.id')
    .where('S.businessId', p.businessId);

  if (p.startDate) {
    query.where('startDate', '<=', formatISO(p.startDate).split('T')[0]);
  }
  if (p.endDate) {
    query.where('endDate', '>=', formatISO(p.endDate).split('T')[0]);
  }

  return query;
};

const updateUser = async (p: AppModels['User'], opt?: Transactionable) => {
  const { id: businessId, ...vals } = p;

  const trx = opt?.txr || (await DB.transaction());

  return DB('Businesses').where('id', businessId).update(vals).transacting(trx);
};

type AddBrandParams = {
  siteId: number;
  fuelSourceId: number;
  usedInId: number;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  rate: number;
};
const setBrands = async (params: AddBrandParams[], opt?: Transactionable) => {
  const trx = opt?.txr || (await DB.transaction());

  const data = {
    brands: [] as (Omit<AddBrandParams, 'days'> & { days: string })[],
  };
  for (let i = 0, len = params.length; i < len; i++) {
    const el = params[i];
    const { days, ...brand } = el;

    data.brands.push({
      ...brand,
      days: days.join(','),
    });
  }

  await DB('BusinessBrands')
    .delete()
    .whereIn(
      'siteId',
      data.brands.map((i) => i.siteId),
    )
    .transacting(trx);
  return DB('BusinessBrands').insert(data.brands).transacting(trx);
};

const saveEnergy = async (p: RequestBodies['SaveBusinessEnergy']['content']['application/json']) => {
  const txr = await DB.transaction();

  try {
    const brandParams: AddBrandParams[] = [];
    const fuelPriceParams = [];
    const fuelSizeParams = [];
    const siteFuelUsedInMap = [];
    const deleteQueryParams: { fuelSourceId: number[]; siteId: number[]; usedInId: number[] } = {
      fuelSourceId: [],
      siteId: [],
      usedInId: [],
    };

    for (let i = 0, len = p.records.length; i < len; i++) {
      const root = p.records[i];

      for (let a = 0, innerLen = root.usedInId.length; a < innerLen; a++) {
        const usedInId = root.usedInId[a];
        deleteQueryParams.usedInId.push(usedInId);
        deleteQueryParams.siteId.push(p.siteId);
        deleteQueryParams.fuelSourceId.push(root.fuelSourceId);

        siteFuelUsedInMap.push({
          siteId: p.siteId,
          fuelSourceId: root.fuelSourceId,
          usedInId,
        });

        const brands = root.brands;
        if (brands && brands.length !== 0) {
          const mapBrand = (b: typeof brands[0]) => {
            return {
              ...b,
              fuelSourceId: root.fuelSourceId,
              siteId: p.siteId,
              usedInId: usedInId,
            };
          };
          brandParams.push(...brands.map(mapBrand));
        }

        if (root.cost) {
          fuelPriceParams.push({
            currencyCode: root.cost.currencyCode,
            vat: root.cost.vat,
            fuelSourceId: root.fuelSourceId,
            usedInId: usedInId,
            siteId: p.siteId,
          });
        }

        if (root.meternumbers) {
          const mapDistance = (b: typeof root.meternumbers[0]) => ({
            fuelSourceId: root.fuelSourceId,
            usedInId: usedInId,
            siteId: p.siteId,
            meters: b.meters,
          });
          fuelSizeParams.push(...root.meternumbers.map(mapDistance));
        }
      }
    }

    const delQueries = ['BusinessFuelsPricing', 'BusinessFuelsSize', 'UsedInToFuelSourceToSite'].map((table) => {
      return DB(table).del<number[]>().whereIn('siteId', deleteQueryParams.siteId).transacting(txr);
    });
    await Promise.all(delQueries);
    await Promise.all([
      setBrands(brandParams, { txr }),
      DB('BusinessFuelsPricing').insert(fuelPriceParams).transacting(txr),
      DB('BusinessFuelsSize').insert(fuelSizeParams).transacting(txr),
      DB('UsedInToFuelSourceToSite').insert(siteFuelUsedInMap).transacting(txr),
    ]);

    return txr.commit();
  } catch (err) {
    await txr.rollback();
    throw err;
  }
};

type GetBusinessEnergiesParams = {
  businessId?: number;
  siteId?: number;
};
const getBusinessEnergies = async <T>(p: GetBusinessEnergiesParams, opt?: { includeSiteId: boolean }) => {
  const query = DB('Sites').select([
    { siteId: 'Sites.id' },
    { fuelSourceId: 'FS.id' },
    { fuelUseId: 'BP.usedInId' },
    { costCurrency: 'BP.currencyCode' },
    { costVat: 'BP.vat' },
    { costFuelSource: 'BP.fuelSourceId' },
    { sizeMeters: 'BF.meters' },
    { brandId: 'BB.id' },
    { brandName: 'BB.name' },
    { brandStartTime: 'BB.startTime' },
    { brandEndTime: 'BB.endTime' },
    { brandRate: 'BB.rate' },
    { brandDays: 'BB.days' },
  ]);

  if (p.businessId) {
    query.where('Sites.businessId', p.businessId);
  }
  if (p.siteId) {
    query.where('Sites.id', p.siteId);
  }

  query
    .innerJoin({ BP: 'BusinessFuelsPricing' }, 'Sites.id', 'BP.siteId')
    .innerJoin({ BF: 'BusinessFuelsSize' }, 'Sites.id', 'BF.siteId')
    .innerJoin({ BB: 'BusinessBrands' }, 'Sites.id', 'BB.siteId')
    .innerJoin({ FS: 'FuelSources' }, (q) => {
      return q
        .on('FS.id', '=', 'BP.fuelSourceId')
        .andOn('FS.id', '=', 'BF.fuelSourceId')
        .andOn('FS.id', '=', 'BB.fuelSourceId');
    })
    .innerJoin({ FUTOFS: 'UsedInToFuelSourceToSite' }, (q) => {
      return q.on('FS.id', 'FUTOFS.fuelSourceId').andOn('FU.id', 'FUTOFS.usedInId').andOn('Sites.id', 'FUTOFS.siteId');
    })
    .innerJoin({ FU: 'FuelUses' }, (q) => {
      return q.on('FS.id', 'FUTOFS.fuelSourceId').andOn('FU.id', 'FUTOFS.usedInId');
    });

  const records = await query;

  const reduceRecords = (r: typeof records): T[] => {
    const energyData = new Map<string, { siteId: number } & AppModels['BusinessEnergy']>();
    let brandData = new Map<string, Map<number, Map<string, AppModels['BusinessEnergy']['brands'][0]>>>();
    let distanceData = new Map<string, Map<number, Map<string, AppModels['BusinessEnergy']['meternumbers'][0]>>>();

    const reduceInnerRecord = <T>(p: {
      mapToReturn: Map<string, Map<number, Map<string, T>>>;
      fuelSourceId: string;
      innerKey: number;
      singleRecordidentifier: string;
      getSingleData: () => T;
    }) => {
      const singleRecord = p.mapToReturn.get(p.fuelSourceId);
      const innerKey = p.innerKey;

      if (singleRecord) {
        const innerArr = singleRecord.get(innerKey);
        innerArr?.set(p.singleRecordidentifier, p.getSingleData());
        if (innerArr) {
          singleRecord.set(innerKey, innerArr);
        }
        p.mapToReturn.set(p.fuelSourceId, singleRecord);
      } else {
        p.mapToReturn.set(
          p.fuelSourceId,
          new Map().set(innerKey, new Map().set(p.singleRecordidentifier, p.getSingleData())),
        );
      }

      return p.mapToReturn;
    };

    for (let i = 0, len = r.length; i < len; i++) {
      const el = r[i];

      const mapKey = el.fuelSourceId;
      const found = energyData.get(mapKey);
      if (!found) {
        energyData.set(mapKey, {
          siteId: el.siteId,
          usedInId: [el.fuelUseId],
          fuelSourceId: el.fuelSourceId,
          brands: [],
          cost: {
            currencyCode: el.costCurrency,
            vat: el.costVat,
          },
          meternumbers: [],
        });
      } else {
        found.usedInId.push(el.fuelUseId);
        found.usedInId = Array.from(new Set(found.usedInId).values());
        energyData.set(mapKey, found);
      }

      brandData = reduceInnerRecord({
        mapToReturn: brandData,
        fuelSourceId: mapKey,
        innerKey: el.siteId,
        singleRecordidentifier: el.brandName,
        getSingleData: () => ({
          name: el.brandName,
          rate: el.brandRate,
          startTime: el.brandStartTime,
          endTime: el.brandEndTime,
          days: el.brandDays.split(','),
        }),
      });

      distanceData = reduceInnerRecord({
        mapToReturn: distanceData,
        fuelSourceId: mapKey,
        innerKey: el.siteId,
        singleRecordidentifier: el.sizeMeters,
        getSingleData: () => ({
          meters: el.sizeMeters,
        }),
      });
    }

    const mapEntries = ([fuelSourceId, record]: [fuelSourceId: string, record: any]) => {
      const val = {
        ...record,
        brands: Array.from(brandData.get(fuelSourceId)?.get(record.siteId)?.values() || []) || [],
        meternumbers: Array.from(distanceData.get(fuelSourceId)?.get(record.siteId)?.values() || []) || [],
      };

      if (opt?.includeSiteId !== true) {
        delete val.siteId;
      }

      return val;
    };
    return Array.from(energyData.entries()).map(mapEntries);
  };

  return reduceRecords(records);
};

export type SaveLogParams = {
  siteId: number;
  usedInId: number;
  startDate: string;
  endDate: string;
  comments: string;
  operation: string;
};
const saveLog = (p: SaveLogParams[]) => {
  const query = DB('BusinessLog').insert(p);
  return query;
};

type SetTenantsParams = {
  businessId: number;
  tenants: AppModels['Tenant'][];
};
const setTenants = (p: SetTenantsParams) => {
  return DB.transaction((trx) => {
    const delQuery = trx('BusinessTenant')
      .del()
      .where((builder) =>
        builder
          .whereIn('siteId', getSinglePropArr({ arr: p.tenants, prop: 'siteId' }))
          .whereIn('usedInId', getSinglePropArr({ arr: p.tenants, prop: 'usedInId' }))
          .whereIn('siteId', trx('Sites').select(['id']).where('businessId', p.businessId)),
      );

    const query = delQuery.then(() => trx('BusinessTenant').insert(p.tenants));
    return query;
  });
};

type SetReviewsParams = {
  businessId: number;
  reviews: AppModels['Review'][];
};
const setReviews = (p: SetReviewsParams) => {
  const reduceReviewsData = (p: AppModels['Review'][]) => {
    const data = {
      reviews: [] as Pick<AppModels['Review'], 'question'>[],
      answers: [] as { answer: string; question: string; siteId: number }[],
    };
    for (let i = 0, len = p.length; i < len; i++) {
      const el = p[i];
      const { answers, ...review } = el;
      data.reviews.push(review);
      data.answers.push(
        ...answers.map((a) => ({
          answer: a,
          question: review.question,
          siteId: review.siteId,
        })),
      );
    }

    return data;
  };

  const data = reduceReviewsData(p.reviews);

  return DB.transaction((trx) => {
    return trx()
      .del()
      .from('Reviews')
      .where((builder) =>
        builder
          .whereIn('siteId', getSinglePropArr({ arr: p.reviews, prop: 'siteId' }))
          .whereIn('siteId', trx('Sites').select(['id']).where('businessId', p.businessId)),
      )
      .then(() => {
        return trx('Reviews').insert(data.reviews);
      })
      .then(() => {
        const mapAnswerQuery = (a: typeof data.answers[0]) => ({
          answer: a.answer,
          reviewId: trx('Reviews')
            .select('Reviews.id')
            .where({
              question: a.question,
              siteId: a.siteId,
            })
            .first(),
        });

        return trx('ReviewsAnswers').insert(data.answers.map(mapAnswerQuery));
      });
  });
};

type SetProgrammesParams = {
  businessId: number;
  programmes: AppModels['Programme'][];
};
const setProgrammes = (p: SetProgrammesParams) => {
  type Programme = NonNullable<typeof p.programmes>[0];

  const reduceProgrammesData = (p: Programme[]) => {
    const data = {
      programmes: [] as Pick<Programme, 'question'>[],
      answers: [] as { answer: string; question: string; siteId: number; usedInId: number }[],
    };
    for (let i = 0, len = p.length; i < len; i++) {
      const el = p[i];
      const { answers, ...programme } = el;
      data.programmes.push(programme);
      data.answers.push(
        ...answers.map((a) => ({
          answer: a,
          question: programme.question,
          siteId: programme.siteId,
          usedInId: programme.usedInId,
        })),
      );
    }

    return data;
  };

  const data = reduceProgrammesData(p.programmes);

  return DB.transaction((trx) => {
    return trx()
      .del()
      .from('Programmes')
      .where((builder) =>
        builder
          .whereIn('siteId', getSinglePropArr({ arr: p.programmes, prop: 'siteId' }))
          .whereIn('usedInId', getSinglePropArr({ arr: p.programmes, prop: 'usedInId' }))
          .whereIn('siteId', trx('Sites').select(['id']).where('businessId', p.businessId)),
      )
      .then(() => {
        return trx('Programmes').insert(data.programmes);
      })
      .then(() => {
        const mapAnswerQuery = (a: typeof data.answers[0]) => ({
          answer: a.answer,
          programmeId: trx('Programmes')
            .select('Programmes.id')
            .where({
              question: a.question,
              siteId: a.siteId,
              usedInId: a.usedInId,
            })
            .first(),
        });

        return trx('ProgrammeAnswers').insert(data.answers.map(mapAnswerQuery));
      });
  });
};

type SetFloorsParams = {
  businessId: number;
  floors: AppModels['BusinessFloor'][];
};
const setFloors = async (p: SetFloorsParams, opt?: Transactionable) => {
  const trx = opt?.txr || (await DB.transaction());
  const mapFloor = (f: typeof p.floors[0]) => {
    return {
      ...f,
      businessId: p.businessId,
    };
  };
  try {
    await DB('Floors').del().where('businessId', p.businessId).transacting(trx);
    const query = DB('Floors').insert(p.floors.map(mapFloor)).transacting(trx);

    if (opt?.txr === undefined) {
      await query;
      return trx.commit();
    } else {
      return query;
    }
  } catch (err) {
    await trx.rollback();
    throw err;
  }
};

type GetSitesByParams = {
  id?: number | number[];
  businessId?: number;
};
const getFloorsBy = async (params?: GetSitesByParams): Promise<(AppModels['BusinessFloor'] & { id: number })[]> => {
  const query = DB('Floors').select();
  if (params?.id) {
    Array.isArray(params?.id) ? query.whereIn('id', params.id) : query.where('id', params.id);
  }
  if (params?.businessId) {
    query.where('businessId', params.businessId);
  }

  return query;
};

export default {
  saveEnergy,
  setBrands,
  getUserBy,
  savePattern,
  updateUser,
  getBusinessEnergies,
  saveLog,
  setTenants,
  setReviews,
  setProgrammes,
  setFloors,
  getFloorsBy,
  getPatterns,
};
