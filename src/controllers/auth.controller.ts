import { AppController } from '@types';
import { AuthService, UserService } from '@services';
import { ApiError } from '@lib';
import { validPassword } from '@utils';
import { AddServiceParams } from '../services/user.service';

export const registerUser: AppController<'Register', 'Register'> = async (req) => {
  const user = await UserService.getUserBy({ email: req.body.email });
  if (user) return new ApiError('Email already registered');

  const { cooling, heating, lighting, powering, ...registerData } = req.body;
  const result = await AuthService.registerUser(registerData);
  const services: AddServiceParams[] = [];
  if (cooling) {
    const service: AddServiceParams = {
      businessId: result[0],
      service: {
        name: 'Cooling',
        ...cooling,
      },
    };
    services.push(service);
  }
  if (heating) {
    const service: AddServiceParams = {
      businessId: result[0],
      service: {
        name: 'Heating',
        ...heating,
      },
    };
    services.push(service);
  }
  if (lighting) {
    const service: AddServiceParams = {
      businessId: result[0],
      service: {
        name: 'Lighting',
        ...lighting,
      },
    };
    services.push(service);
  }
  if (powering) {
    const service: AddServiceParams = {
      businessId: result[0],
      service: {
        name: 'Powering',
        ...powering,
      },
    };
    services.push(service);
  }

  if (services.length !== 0) {
    await UserService.addService(services);
  }

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
