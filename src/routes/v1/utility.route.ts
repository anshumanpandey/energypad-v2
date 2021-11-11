import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UtilityController } from '@controllers';
import { CreateUtilityPath } from '@openApi';

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

export default authRoutes;
