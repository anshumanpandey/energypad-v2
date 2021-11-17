import { AuthAppController, AuthGetAppController } from '@types';
import { UserService } from '@services';
import { ApiError } from '@lib';

export const updateUser: AuthAppController<'UpdateUser', 'UpdateUser'> = async (req) => {
  const { cooling, heating, lighting, powering, ...registerData } = req.body;

  await UserService.updateUser({ ...registerData, id: req.user.id });

  await UserService.saveSupportedServices({
    businessId: req.user.id,
    cooling,
    heating,
    lighting,
    powering,
  });

  return { success: true };
};

export const getMet: AuthGetAppController<'GetUser'> = async (req) => {
  const user = await UserService.getUserBy({ id: req.user.id });
  if (!user) return new ApiError('User not found');

  return user;
};
