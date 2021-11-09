import { AppController } from '@types';
import { AuthService } from '@services';

export const registerUser: AppController<'Register'> = async (req) => {
  await AuthService.registerUser(req.body);
  return { success: true };
};
