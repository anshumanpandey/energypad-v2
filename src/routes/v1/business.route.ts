import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware, FileUpload } from '@middleware';
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
  SetBusinessSetFloorsPath,
  SetBusinessPatternsPath,
  GetBusinessFloorsPath,
  GetPatternsPath,
  FileImportBusinessPath,
} from '@openApi';

const businessRoutes = express.Router();

businessRoutes.get('/', GetUserPath, AuthMiddleware, ExpressAsync(UserController.getMet));
businessRoutes.get('/energies', GetBusinessEnergyPath, AuthMiddleware, ExpressAsync(UserController.getBusinessEnergy));
businessRoutes.get('/sites', GetBusinessSitesPath, AuthMiddleware, ExpressAsync(UserController.getSites));
businessRoutes.get('/foors', GetBusinessFloorsPath, AuthMiddleware, ExpressAsync(UserController.getBusinessFloors));
businessRoutes.get('/patterns', GetPatternsPath, AuthMiddleware, ExpressAsync(UserController.getPatterns));

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
  '/savePattern',
  SetBusinessPatternsPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SaveBusinessPattern',
  }),
  ExpressAsync(UserController.savePattenrs),
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
  '/setFloors',
  SetBusinessSetFloorsPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetFloors',
  }),
  ExpressAsync(UserController.setFloors),
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

businessRoutes.post(
  '/importBusiness',
  FileImportBusinessPath,
  AuthMiddleware,
  FileUpload.single('excel'),
  ExpressAsync(UserController.importFile),
);

export default businessRoutes;
