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
  GetUsedInPath,
  LogFileImportPath,
  UtilityFileImportPath,
  AddUtilityMonitoringPath,
  GetMonitoringPath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/savingTips', GetSavingTipsPath, AuthMiddleware, ExpressAsync(UtilityController.getSavingTips));
authRoutes.get('/fuelSources', GetFuelSourcesPath, AuthMiddleware, ExpressAsync(UtilityController.getFuelSources));
authRoutes.get('/fuelUse', GetUsedInPath, AuthMiddleware, ExpressAsync(UtilityController.getUses));
authRoutes.get('/emissions', GetEmissionsPath, AuthMiddleware, ExpressAsync(UtilityController.getEmissions));
authRoutes.get('/consumptions', GetConsumptionsPath, AuthMiddleware, ExpressAsync(UtilityController.getConsumptions));
authRoutes.get('/monitoring', GetMonitoringPath, AuthMiddleware, ExpressAsync(UtilityController.getMonitoring));
authRoutes.get('/businessTips', AuthMiddleware, ExpressAsync(UtilityController.getBusinessTips));

authRoutes.post(
  '/addEmission',
  AddUtilityEmissionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddFuelSourceEmission',
  }),
  ExpressAsync(UtilityController.addEmission),
);

authRoutes.post(
  '/addConsumption',
  AddUtilityConsumptionPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddFuelSourceConsumption',
  }),
  ExpressAsync(UtilityController.addConsumption),
);

authRoutes.post(
  '/addMonitoring',
  AddUtilityMonitoringPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddFuelSourceMonitoring',
  }),
  ExpressAsync(UtilityController.addMonitoring),
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

authRoutes.post(
  '/importUtilityEmissions',
  AuthMiddleware,
  FileUpload.single('excel'),
  ExpressAsync(UtilityController.importUtilityEmissionFromFile),
);

authRoutes.post(
  '/mapTipToBusiness',
  AuthMiddleware,
  ExpressAsync(UtilityController.saveTipsMapping),
);

export default authRoutes;
