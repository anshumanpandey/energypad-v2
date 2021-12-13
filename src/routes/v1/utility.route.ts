import express from 'express';
import { AuthMiddleware, ExpressAsync, FileUpload, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import {
  AddUtilityConsumptionPath,
  AddUtilityEmissionPath,
  CreateUtilityPath,
  GetSavingTipsPath,
  GetUtilitiesPath,
  UtilityFileImportPath,
} from '@openApi';

const authRoutes = express.Router();

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

authRoutes.get('/', GetUtilitiesPath, AuthMiddleware, ExpressAsync(UtilityController.getUtilities));

authRoutes.get('/savingTips', GetSavingTipsPath, AuthMiddleware, ExpressAsync(UtilityController.getSavingTips));

export default authRoutes;
