import { AppController } from '@types';

export const createUserController: AppController<'CreateUser'> = async (req) => {
  return { success: 'yes' };
};
