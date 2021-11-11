import { AppController } from '@types';
import { AuthService, UserService } from '@services';
import { ApiError } from '@lib';
import { validPassword } from '@utils';

export const registerUser: AppController<'Register'> = async (req) => {
  await AuthService.registerUser(req.body);
  return { success: true };
};

export const loginUser: AppController<'Login'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (!user) return new ApiError('Credentials not found');

  const isValid = await validPassword(req.body.password, user.password);
  if (isValid === false) return new ApiError('Wrong credentials');

  const jwt = await AuthService.generateJwt({ id: user.id });
  return { jwt };
};
