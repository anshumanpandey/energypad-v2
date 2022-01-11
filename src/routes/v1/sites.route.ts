import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { SitesController } from '@controllers';
import { CreateSitePath, DeleteSitePath, GetSiteDetailsPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/details/:siteId', GetSiteDetailsPath, AuthMiddleware, ExpressAsync(SitesController.getSiteDetails));

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
