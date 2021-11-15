import { AppController } from '@types';
import { UtilityServices } from '@services';

export const createUtility: AppController<'CreateUtility'> = async (req) => {
  await UtilityServices.create(req.body);

  return { success: true };
};

export const addEmission: AppController<'AddUtilityEmission'> = async (req) => {
  const utilityId = req.params.utilityId;
  const params = {
    ...req.body,
    utilityId,
  };

  await UtilityServices.addConsumptionToUtility(params);

  return { success: true };
};
