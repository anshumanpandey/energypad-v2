import { AppController } from '@types';
import { UtilityServices } from '@services';

export const createUtility: AppController<'CreateUtility'> = async (req) => {
  await UtilityServices.create(req.body);

  return { success: true };
};
