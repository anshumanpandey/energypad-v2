import { DB } from '@lib';
import { AppModels } from '@types';

const getUserBy = (params: { id?: string; email?: string }) => {
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
const addService = async (params: AddServiceParams | AddServiceParams[]) => {
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

  return DB('BusinessService').insert(data);
};

export default {
  getUserBy,
  addService,
};
