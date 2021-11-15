import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import { AddUtilityPath, CreateUtilityPath } from '@openApi';

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

export default authRoutes;
