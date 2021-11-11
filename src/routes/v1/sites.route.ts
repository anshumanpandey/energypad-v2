import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { createSite } from '@controllers';
import { CreateSitePath } from '@openApi';

const authRoutes = express.Router();

authRoutes.post(
  '/',
  CreateSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'Site',
  }),
  ExpressAsync(createSite),
);

export default authRoutes;
