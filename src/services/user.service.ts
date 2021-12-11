import { DB } from '@lib';
import { AppModels, Transactionable } from '@types';

const getUserBy = async (params: { id?: number; email?: string }) => {
  const query = DB('Businesses')
    .select([
      'Businesses.*',
      'Programmes.id as ProgrammeId',
      'Programmes.question',
      'ProgrammeAnswers.answer',
      'Brands.id as BrandId',
      'Brands.name as brandName',
      'Brands.startTime as brandStartTime',
      'Brands.endTime as brandEndTime',
      'Brands.rate as brandRate',
      'BrandDays.name as brandDay',
    ])
    .leftJoin('Utilities', 'Businesses.id', 'Utilities.businessId')
    .leftJoin('Programmes', 'Utilities.id', 'Programmes.utilityId')
    .leftJoin('ProgrammeAnswers', 'Programmes.id', 'ProgrammeAnswers.programmeId')
    .leftJoin({ B: 'Businesses' }, 'Utilities.businessId', 'B.id')
    .leftJoin('Brands', 'Businesses.id', 'Brands.businessId')
    .leftJoin('BrandDays', 'Brands.id', 'BrandDays.brandId');

  if (params.id) {
    query.where({ 'Businesses.id': params.id });
  }
  if (params.email) {
    query.where({ 'Businesses.email': params.email });
  }

  const records = await query;
  const reduceRecords = (r: any[]) => {
    const programmes = new Map();
    const brands = new Map();

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

      const { BrandId, brandName, brandStartTime, brandEndTime, brandRate, brandDay } = el;
      if (BrandId && brands.has(BrandId) === false) {
        brands.set(BrandId, { id: BrandId, brandName, brandStartTime, brandEndTime, brandRate, days: [brandDay] });
      } else if (BrandId && brands.has(BrandId) === true) {
        const brand = brands.get(BrandId);
        brand.days.push(brandDay);
        brands.set(BrandId, brand);
      }
    }
    const first = r[0];
    if (first) {
      first.programmes = Array.from(programmes.values()) || [];
      first.brands = Array.from(brands.values()) || [];
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
  businessId: number;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  rate: number;
};
const addBrands = (params: AddBrandParams[]) => {
  return DB.transaction(async function (trx) {
    const data = {
      brands: [] as Omit<AddBrandParams, 'days'>[],
      days: [] as { name: string; brandId: string }[],
    };
    for (let i = 0, len = params.length; i < len; i++) {
      const el = params[i];
      const { days, ...brand } = el;

      const mapD = (d: string) => {
        return {
          brandId: trx('Brands').select('id').where(brand).first() as unknown as string,
          name: d,
        };
      };

      data.brands.push(brand);
      data.days.push(...days.map(mapD));
    }

    await trx('Brands').delete().where('businessId', data.brands[0].businessId);
    await trx('Brands').insert(data.brands);
    await trx('BrandDays').insert(data.days);
  });
};

export default {
  addBrands,
  getUserBy,
  addService,
  updateUser,
  saveSupportedServices,
};
