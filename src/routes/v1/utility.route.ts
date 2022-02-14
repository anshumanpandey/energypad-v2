import express from 'express';
import { AuthMiddleware, ExpressAsync, FileUpload, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import {
  AddUtilityConsumptionPath,
  AddUtilityEmissionPath,
  GetConsumptionsPath,
  GetEmissionsPath,
  GetFuelSourcesPath,
  GetSavingTipsPath,
  LogFileImportPath,
  UtilityFileImportPath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/savingTips', GetSavingTipsPath, AuthMiddleware, ExpressAsync(UtilityController.getSavingTips));
authRoutes.get('/fuelSources', GetFuelSourcesPath, AuthMiddleware, ExpressAsync(UtilityController.getFuelSources));
authRoutes.get('/emissions', GetEmissionsPath, AuthMiddleware, ExpressAsync(UtilityController.getEmissions));
authRoutes.get('/consumptions', GetConsumptionsPath, AuthMiddleware, ExpressAsync(UtilityController.getEmissions));

authRoutes.post(
  '/addEmission/:fuelSourceId',
  AddUtilityEmissionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddFuelSourceEmission',
  }),
  ExpressAsync(UtilityController.addEmission),
);

authRoutes.post(
  '/addConsumption/:fuelSourceId',
  AddUtilityConsumptionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddFuelSourceConsumption',
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

authRoutes.post(
  '/importLogs',
  LogFileImportPath,
  AuthMiddleware,
  FileUpload.single('excel'),
  ExpressAsync(UtilityController.importLog),
);

export default authRoutes;
