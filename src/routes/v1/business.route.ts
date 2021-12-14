import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UserController } from '@controllers';
import {
  GetUserPath,
  UpdateUserPath,
  AddBrandToBusinessPath,
  GetBusinessEnergyPath,
  AddBusinessLogPath,
  SetBusinessTenantPath,
  SetBusinessReviewPath,
  SetBusinessSetProgrammesPath,
  GetBusinessSitesPath,
} from '@openApi';

const businessRoutes = express.Router();

businessRoutes.get('/', GetUserPath, AuthMiddleware, ExpressAsync(UserController.getMet));
businessRoutes.get('/energies', GetBusinessEnergyPath, AuthMiddleware, ExpressAsync(UserController.getBusinessEnergy));
businessRoutes.get('/sites', GetBusinessSitesPath, AuthMiddleware, ExpressAsync(UserController.getSites));

businessRoutes.put(
  '/',
  UpdateUserPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'UpdateUser',
  }),
  ExpressAsync(UserController.updateUser),
);

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

businessRoutes.post(
  '/setTenants',
  SetBusinessTenantPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetTenants',
  }),
  ExpressAsync(UserController.setTenants),
);

businessRoutes.post(
  '/setReviews',
  SetBusinessReviewPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetReviews',
  }),
  ExpressAsync(UserController.setReviews),
);

businessRoutes.post(
  '/setProgrammes',
  SetBusinessSetProgrammesPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetProgrammes',
  }),
  ExpressAsync(UserController.setProgrammes),
);

export default businessRoutes;
