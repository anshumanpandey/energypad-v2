import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { SitesController } from '@controllers';
import { CreateSitePath, DeleteSitePath } from '@openApi';

const authRoutes = express.Router();

authRoutes.post(
  '/',
  CreateSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'Site',
  }),
  ExpressAsync(SitesController.createSite),
);

authRoutes.delete(
  '/',
  DeleteSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'DeleteSite',
  }),
  ExpressAsync(SitesController.deleteSite),
);

export default authRoutes;
