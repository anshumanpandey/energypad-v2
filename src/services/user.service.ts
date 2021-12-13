import { DB } from '@lib';
import { AppModels, RequestBodies, Transactionable } from '@types';

const getUserBy = async (params: { id?: number; email?: string }) => {
  const query = DB('Businesses')
    .select(['Businesses.*', 'Programmes.id as ProgrammeId', 'Programmes.question', 'ProgrammeAnswers.answer'])
    .leftJoin('Utilities', 'Businesses.id', 'Utilities.businessId')
    .leftJoin('Programmes', 'Utilities.id', 'Programmes.utilityId')
    .leftJoin('ProgrammeAnswers', 'Programmes.id', 'ProgrammeAnswers.programmeId')
    .leftJoin({ B: 'Businesses' }, 'Utilities.businessId', 'B.id');

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
      if (programmes.has(ProgrammeId) === false) {
        programmes.set(ProgrammeId, { id: ProgrammeId, question, answers: [answer] });
      } else {
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

export type AddServiceParams = { businessId: number; service: { name: string } & AppModels['BusinessService'] };
const addService = async (params: AddServiceParams | AddServiceParams[], opt?: Transactionable) => {
  const data = [];

  if (Array.isArray(params)) {
    for (let index = 0, lng = params.length; index < lng; index++) {
      const element = params[index];
      data.push({
        businessId: element.businessId,
        name: element.service.name,
        startDate: element.service.startDate,
        endDate: element.service.endDate,
        consumption: element.service.consumption,
        daysOnYear: element.service.daysOnYear,
      });
    }
  } else {
    data.push({
      businessId: params.businessId,
      name: params.service.name,
      startDate: params.service.startDate,
      endDate: params.service.endDate,
      consumption: params.service.consumption,
      daysOnYear: params.service.daysOnYear,
    });
  }

  const query = DB('BusinessService').insert(data);
  if (opt?.txr) {
    query.transacting(opt.txr);
  }

  return query;
};

const updateUser = (p: AppModels['User']) => {
  const { id, floors, programmes, ...vals } = p;
  type Programme = NonNullable<typeof programmes>[0];

  const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId: id });
  const floorsData = floors.map(mapFloors);

  const reduceProgrammesData = (p: Programme[]) => {
    const data = {
      programmes: [] as Pick<Programme, 'question' | 'utilityId'>[],
      answers: [] as { answer: string; question: string }[],
    };
    for (let i = 0, len = p.length; i < len; i++) {
      const el = p[i];
      const { answers, ...programme } = el;
      data.programmes.push(programme);
      data.answers.push(...answers.map((a) => ({ answer: a, question: programme.question })));
    }

    return data;
  };

  return DB.transaction(async function (trx) {
    await trx('Businesses').where('id', id).update(vals);

    await trx('Floors').where('businessId', id).del();
    await trx('Floors').insert(floorsData);

    if (programmes && programmes.length !== 0) {
      await trx()
        .del()
        .from('Programmes')
        .whereIn('Programmes.utilityId', (q) => {
          return q.select('id').from('Utilities').where('businessId', id);
        });
      const data = reduceProgrammesData(programmes);
      await trx('Programmes').insert(data.programmes);

      const mapAnswerQuery = (a: typeof data.answers[0]) => ({
        answer: a.answer,
        programmeId: trx('Programmes')
          .select('Programmes.id')
          .where({
            question: a.question,
          })
          .innerJoin('Utilities', 'Programmes.utilityId', 'Utilities.id')
          .innerJoin('Businesses', 'Utilities.businessId', 'Businesses.id')
          .first(),
      });

      await trx('ProgrammeAnswers').insert(data.answers.map(mapAnswerQuery));
    }
  });
};

type SaveSupportedServicesParams = {
  businessId: number;
  cooling?: AppModels['BusinessService'];
  heating?: AppModels['BusinessService'];
  lighting?: AppModels['BusinessService'];
  powering?: AppModels['BusinessService'];
};
const saveSupportedServices = (p: SaveSupportedServicesParams, opt?: Transactionable) => {
  const services: AddServiceParams[] = [];
  if (p.cooling) {
    const service: AddServiceParams = {
      businessId: p.businessId,
      service: {
        name: 'Cooling',
        ...p.cooling,
      },
    };
    services.push(service);
  }
  if (p.heating) {
    const service: AddServiceParams = {
      businessId: p.businessId,
      service: {
        name: 'Heating',
        ...p.heating,
      },
    };
    services.push(service);
  }
  if (p.lighting) {
    const service: AddServiceParams = {
      businessId: p.businessId,
      service: {
        name: 'Lighting',
        ...p.lighting,
      },
    };
    services.push(service);
  }
  if (p.powering) {
    const service: AddServiceParams = {
      businessId: p.businessId,
      service: {
        name: 'Powering',
        ...p.powering,
      },
    };
    services.push(service);
  }

  if (services.length !== 0) {
    return addService(services, opt);
  }

  return Promise.resolve();
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
  await trx('BusinessBrands').insert(data.brands);
};

type SaveEnergyParams = {
  fuelSourceId: number;
  usedInId: number;
};
const saveEnergy = async (p: SaveEnergyParams & RequestBodies['SaveBusinessEnergy']['content']['application/json']) => {
  const txr = await DB.transaction();

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

export default {
  saveEnergy,
  setBrands,
  getUserBy,
  addService,
  updateUser,
  saveSupportedServices,
  getBusinessEnergies,
};
