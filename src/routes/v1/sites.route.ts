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
  SetSiteConversionUnitPath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/details/:siteId', GetSiteDetailsPath, AuthMiddleware, ExpressAsync(SitesController.getSiteDetails));
authRoutes.get('/countries', GetCountriesPath, ExpressAsync(SitesController.getCountries));
authRoutes.get('/states', GetStatesPath, ExpressAsync(SitesController.getStates));

authRoutes.post(
  '/',
  CreateSitePath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'Site',
  }),
  ExpressAsync(SitesController.createSite),
);

authRoutes.post(
  '/setConversionUnit/:siteId',
  SetSiteConversionUnitPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetSiteConversionUnit',
  }),
  ExpressAsync(SitesController.setSiteUnitConversion),
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
