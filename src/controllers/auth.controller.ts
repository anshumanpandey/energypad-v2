import { AppController } from '@types';
import { AuthService, UserService } from '@services';
import { ApiError } from '@lib';
import { DbUtils, validPassword } from '@utils';

export const registerUser: AppController<'Register', 'Register'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (user) return new ApiError('Email already registered');

  const { ...registerData } = req.body;

  const txr = await DbUtils.createTransaction();
  try {
    const { floors, ...register } = registerData;
    const newUser = await AuthService.registerUser(register, { txr });
    if (floors && floors.length > 0) {
      await UserService.setFloors({ floors: floors, businessId: newUser }, { txr });
    }
    await txr.commit();
    return { success: true };
  } catch (err) {
    await txr.rollback();
    if (err instanceof ApiError) {
      return err;
    } else {
      throw err;
    }
  }
};

export const loginUser: AppController<'Login', 'Login'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (!user) return new ApiError('Credentials not found');

  const isValid = await validPassword(req.body.password, user.password);
  if (isValid === false) return new ApiError('Wrong credentials');

  const jwt = await AuthService.generateJwt({ id: user.id });
  return { jwt, ...user };
};
