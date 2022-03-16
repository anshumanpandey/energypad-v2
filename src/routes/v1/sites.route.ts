import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { SitesController } from '@controllers';
import {
  CreateSitePath,
  DeleteSitePath,
  GetCountriesPath,
  GetSiteDetailsPath,
  GetStatesPath,
  UpdateSitePath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/details/:siteId', GetSiteDetailsPath, AuthMiddleware, ExpressAsync(SitesController.getSiteDetails));
authRoutes.get('/countries', GetCountriesPath, AuthMiddleware, ExpressAsync(SitesController.getCountries));
authRoutes.get('/states', GetStatesPath, AuthMiddleware, ExpressAsync(SitesController.getStates));

authRoutes.post(
  '/',
  CreateSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'Site',
  }),
  ExpressAsync(SitesController.createSite),
);

authRoutes.put(
  '/update/:siteId',
  UpdateSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SiteUpdate',
  }),
  ExpressAsync(SitesController.updateSite),
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
