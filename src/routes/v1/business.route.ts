import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UserController } from '@controllers';
import {
  GetUserPath,
  UpdateUserPath,
  AddBrandToBusinessPath,
  GetBusinessEnergyPath,
  AddBusinessLogPath,
} from '@openApi';

const businessRoutes = express.Router();

businessRoutes.put(
  '/',
  UpdateUserPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'UpdateUser',
  }),
  ExpressAsync(UserController.updateUser),
);

businessRoutes.get('/', GetUserPath, AuthMiddleware, ExpressAsync(UserController.getMet));
businessRoutes.get('/energies', GetBusinessEnergyPath, AuthMiddleware, ExpressAsync(UserController.getBusinessEnergy));

businessRoutes.post(
  '/saveEnergy',
  AddBrandToBusinessPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SaveBusinessEnergy',
  }),
  ExpressAsync(UserController.saveEnergy),
);

businessRoutes.post(
  '/addLog',
  AddBusinessLogPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddLog',
  }),
  ExpressAsync(UserController.addLog),
);

export default businessRoutes;
