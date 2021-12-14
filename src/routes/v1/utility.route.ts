import express from 'express';
import { AuthMiddleware, ExpressAsync, FileUpload, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import {
  AddUtilityConsumptionPath,
  AddUtilityEmissionPath,
  CreateUtilityPath,
  GetFuelSourcesPath,
  GetSavingTipsPath,
  GetUtilitiesPath,
  UtilityFileImportPath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/', GetUtilitiesPath, AuthMiddleware, ExpressAsync(UtilityController.getUtilities));
authRoutes.get('/savingTips', GetSavingTipsPath, AuthMiddleware, ExpressAsync(UtilityController.getSavingTips));
authRoutes.get('/fuelSources', GetFuelSourcesPath, AuthMiddleware, ExpressAsync(UtilityController.getFuelSources));

authRoutes.post(
  '/',
  CreateUtilityPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'CreateUtility',
  }),
  ExpressAsync(UtilityController.createUtility),
);

authRoutes.post(
  '/addEmission/:utilityId',
  AddUtilityEmissionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddUtilityEmission',
  }),
  ExpressAsync(UtilityController.addEmission),
);

authRoutes.post(
  '/addConsumption/:utilityId',
  AddUtilityConsumptionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddUtilityConsumption',
  }),
  ExpressAsync(UtilityController.addConsumption),
);

authRoutes.post(
  '/importUtility',
  UtilityFileImportPath,
  AuthMiddleware,
  FileUpload.single('excel'),
  ExpressAsync(UtilityController.importFile),
);

export default authRoutes;
