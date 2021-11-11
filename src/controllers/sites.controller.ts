import { AuthAppController } from '@types';
import { SitesServices } from '@services';

export const createSite: AuthAppController<'Site'> = async (req) => {
  const params = {
    ...req.body,
    businessId: req.user.id,
  };
  await SitesServices.createSite(params);
  return { success: true };
};
