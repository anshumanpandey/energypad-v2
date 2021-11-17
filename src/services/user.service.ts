import { DB } from '@lib';
import { AppModels, Transactionable } from '@types';

const getUserBy = (params: { id?: number; email?: string }) => {
  const query = DB('Businesses').select<AppModels['User']>('*');
  if (params.id) {
    query.where({ id: params.id });
  }
  if (params.email) {
    query.where({ email: params.email });
  }
  return query.first();
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
  const { id, floors, ...vals } = p;

  const mapFloors = (f: typeof floors[0]) => ({ ...f, businessId: id });
  const floorsData = floors.map(mapFloors);

  return DB.transaction(function (trx) {
    return trx('Businesses')
      .where('id', id)
      .update(vals)
      .then(() => trx('Floors').where('businessId', id).del())
      .then(() => trx('Floors').insert(floorsData));
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

export default {
  getUserBy,
  addService,
  updateUser,
  saveSupportedServices,
};
