import express from 'express';
import { AuthMiddleware, ExpressAsync, FileUpload, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import { AddUtilityPath, CreateUtilityPath, GetUtilitiesPath, UtilityFileImportPath } from '@openApi';

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
  AddUtilityPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'AddUtilityEmission',
  }),
  ExpressAsync(UtilityController.addEmission),
);

authRoutes.post(
  '/importUtility',
  UtilityFileImportPath,
  AuthMiddleware,
  FileUpload.single('excel'),
  ExpressAsync(UtilityController.importFile),
);

authRoutes.get('/', GetUtilitiesPath, AuthMiddleware, ExpressAsync(UtilityController.getUtilities));

export default authRoutes;
