import { AppController } from '@types';
import { AuthService, UserService } from '@services';
import { ApiError } from '@lib';
import { validPassword } from '@utils';

export const registerUser: AppController<'Register', 'Register'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (user) return new ApiError('Email already registered');

  const { cooling, heating, lighting, powering, ...registerData } = req.body;
  const result = await AuthService.registerUser(registerData);
  await UserService.saveSupportedServices({
    businessId: result[0],
    cooling,
    heating,
    lighting,
    powering,
  });

  return { success: true };
};

export const loginUser: AppController<'Login', 'Login'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (!user) return new ApiError('Credentials not found');

  const isValid = await validPassword(req.body.password, user.password);
  if (isValid === false) return new ApiError('Wrong credentials');

  const jwt = await AuthService.generateJwt({ id: user.id });
  return { jwt };
};
