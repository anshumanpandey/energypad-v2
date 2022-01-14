import { AuthAppController, AuthGetAppController } from '@types';
import { SitesService } from '@services';
import { ApiError } from '@lib';

export const getSiteDetails: AuthGetAppController<'GetSiteDetails'> = async (req) => {
  const siteId = parseInt(req.params.siteId, 10);
  const [site] = await SitesService.findBy({ id: siteId });
  if (!site) {
    return new ApiError('Site not found');
  }
  const details = await SitesService.getSiteDetails({ id: siteId });
  return details;
};

export const createSite: AuthAppController<'Site', 'Site'> = async (req) => {
  const params = {
    ...req.body,
    businessId: req.user.id,
  };
  const res = await SitesService.createSite(params);

  return { id: Array.isArray(res) ? res[0] : res };
};

export const updateSite: AuthAppController<'SiteUpdate', 'SiteUpdate'> = async (req) => {
  const siteId = parseInt(req.params.siteId, 10);
  const params = {
    ...req.body,
    id: siteId,
    businessId: req.user.id,
  };
  const [site] = await SitesService.findBy({ id: siteId });
  if (!site) {
    return new ApiError('Site not found');
  }
  await SitesService.createSite(params);

  return { success: true };
};

export const deleteSite: AuthAppController<'DeleteSite', 'DeleteSite'> = async (req) => {
  const params = {
    id: req.body.id,
  };
  const [found] = await SitesService.findBy(params);
  if (!found) return new ApiError('Site not found');

  await SitesService.deleteById(params);

  return { success: true };
};
