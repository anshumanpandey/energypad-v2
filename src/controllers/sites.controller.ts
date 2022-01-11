import { AuthAppController } from '@types';
import { SitesService } from '@services';
import { ApiError } from '@lib';

export const createSite: AuthAppController<'Site', 'Site'> = async (req) => {
  const params = {
    ...req.body,
    businessId: req.user.id,
  };
  const [id] = await SitesService.createSite(params);
  return { id };
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
