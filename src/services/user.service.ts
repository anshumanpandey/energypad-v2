import { DB } from '@lib';
import { getSinglePropArr } from '@utils';
import { AppModels, RequestBodies, Transactionable } from '@types';

const getUserBy = async (params: { id?: number; email?: string }) => {
  const query = DB('Businesses')
    .select(['Businesses.*', 'Programmes.id as ProgrammeId', 'Programmes.question', 'ProgrammeAnswers.answer'])
    .leftJoin('Utilities', 'Businesses.id', 'Utilities.businessId')
    .leftJoin({ B: 'Businesses' }, 'Utilities.businessId', 'B.id')
    .leftJoin('Sites', 'B.id', 'Sites.businessId')
    .leftJoin('Programmes', 'Sites.id', 'Programmes.siteId')
    .leftJoin('ProgrammeAnswers', 'Programmes.id', 'ProgrammeAnswers.programmeId');

  if (params.id) {
    query.where({ 'Businesses.id': params.id });
  }
  if (params.email) {
    query.where({ 'Businesses.email': params.email });
  }

  const records = await query;
  const reduceRecords = (r: any[]) => {
    const programmes = new Map();

    for (let i = 0, len = r.length; i < len; i++) {
      const el = r[i];
      const { question, answer, ProgrammeId } = el;
      if (ProgrammeId && programmes.has(ProgrammeId) === false) {
        programmes.set(ProgrammeId, { id: ProgrammeId, question, answers: [answer] });
      } else if (ProgrammeId && programmes.has(ProgrammeId) === true) {
        const programme = programmes.get(ProgrammeId);
        programme.answers.push(answer);
        programmes.set(ProgrammeId, programme);
      }
    }
    const first = r[0];
    if (first) {
      first.programmes = Array.from(programmes.values()) || [];
    }
    return first;
  };
  const record = reduceRecords(records);
  return record;
};

export type AddServiceParams = { businessId: number; patterns: AppModels['BusinessPattern'][] };
export const savePattern = async (params: AddServiceParams, opt?: Transactionable) => {
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

const updateUser = async (p: AppModels['User'], opt?: Transactionable) => {
  const { id: businessId, floors, programmes, ...vals } = p;
  type Programme = NonNullable<typeof programmes>[0];

  const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId });
  const floorsData = floors.map(mapFloors);

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

  const trx = opt?.txr || (await DB.transaction());

  return trx('Businesses')
    .where('id', businessId)
    .update(vals)
    .then(() => {
      return trx('Floors').where('businessId', businessId).del();
    })
    .then(() => {
      return trx('Floors').insert(floorsData);
    })
    .then(() => {
      if (programmes && programmes.length !== 0) {
        const data = reduceProgrammesData(programmes);

        return trx()
          .del()
          .from('Programmes')
          .where((builder) =>
            builder
              .whereIn('siteId', getSinglePropArr({ arr: programmes, prop: 'siteId' }))
              .whereIn('usedInId', getSinglePropArr({ arr: programmes, prop: 'usedInId' }))
              .whereIn('siteId', trx('Sites').select(['id']).where('businessId', businessId)),
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
      }
    })
    .then(trx.commit)
    .catch(trx.rollback);
};

type AddBrandParams = {
  siteId: number;
  fuelSourceId: number;
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

  await trx('BusinessBrands')
    .delete()
    .where('fuelSourceId', data.brands[0].fuelSourceId)
    .andWhere('siteId', data.brands[0].siteId);
  return trx('BusinessBrands').insert(data.brands);
};

type SaveEnergyParams = {
  fuelSourceId: number;
  usedInId: number;
};
const saveEnergy = async (p: SaveEnergyParams & RequestBodies['SaveBusinessEnergy']['content']['application/json']) => {
  const txr = await DB.transaction();

  try {
    const brands = p.brands;
    if (brands && brands.length !== 0) {
      const mapBrand = (b: typeof brands[0]) => {
        return {
          ...b,
          fuelSourceId: p.fuelSourceId,
          siteId: p.siteId,
        };
      };
      await setBrands(brands.map(mapBrand), { txr });
    }

    if (p.cost) {
      await DB('BusinessFuelsPricing')
        .insert({
          currencyCode: p.cost.currencyCode,
          vat: p.cost.vat,
          fuelSourceId: p.fuelSourceId,
          siteId: p.siteId,
        })
        .transacting(txr);
    }

    if (p.distance) {
      const mapDistance = (b: typeof p.distance[0]) => ({
        fuelSourceId: p.fuelSourceId,
        siteId: p.siteId,
        meters: b.meters,
      });
      await DB('BusinessFuelsSize').insert(p.distance.map(mapDistance)).transacting(txr);
    }

    return txr.commit();
  } catch (err) {
    return txr.rollback();
  }
};

type GetBusinessEnergiesParams = {
  businessId: number;
};
const getBusinessEnergies = async (p: GetBusinessEnergiesParams) => {
  const query = DB('Sites')
    .select([
      { siteId: 'Sites.id' },
      { fuelSourceId: 'FS.id' },
      { fuelUseId: 'FU.id' },
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
    ])
    .where('Sites.businessId', p.businessId)
    .innerJoin({ BP: 'BusinessFuelsPricing' }, 'Sites.id', 'BP.siteId')
    .innerJoin({ BF: 'BusinessFuelsSize' }, 'Sites.id', 'BF.siteId')
    .innerJoin({ BB: 'BusinessBrands' }, 'Sites.id', 'BB.siteId')
    .innerJoin({ FS: 'FuelSources' }, (q) => {
      q.on('FS.id', '=', 'BP.fuelSourceId')
        .andOn('FS.id', '=', 'BF.fuelSourceId')
        .andOn('FS.id', '=', 'BB.fuelSourceId');
    })
    .innerJoin({ FU: 'FuelUses' }, 'FS.id', 'FU.fuelSourceId');

  const records = await query;

  const reduceRecords = (r: typeof records): AppModels['BusinessEnergy'][] => {
    const energyData = new Map<string, AppModels['BusinessEnergy']>();
    let brandData = new Map<string, Map<number, Map<string, AppModels['BusinessEnergy']['brands'][0]>>>();
    let distanceData = new Map<string, Map<number, Map<string, AppModels['BusinessEnergy']['distance'][0]>>>();

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
      energyData.set(mapKey, {
        usedInId: el.fuelUseId,
        siteId: el.siteId,
        brands: [],
        cost: {
          currencyCode: el.costCurrency,
          vat: el.costVat,
        },
        distance: [],
      });

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
      return {
        ...record,
        brands: Array.from(brandData.get(fuelSourceId)?.get(record.siteId)?.values() || []) || [],
        distance: Array.from(distanceData.get(fuelSourceId)?.get(record.siteId)?.values() || []) || [],
      };
    };
    return Array.from(energyData.entries()).map(mapEntries);
  };

  return reduceRecords(records);
};

type SaveLogParams = {
  siteId: number;
  usedInId: number;
  startDate: string;
  endDate: string;
  comments: string;
  operation: string;
};
const saveLog = (p: SaveLogParams) => {
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

export default {
  saveEnergy,
  setBrands,
  getUserBy,
  savePattern,
  updateUser,
  getBusinessEnergies,
  saveLog,
  setTenants,
};
