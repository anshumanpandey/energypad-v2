import { AuthAppController } from '@types';
import { SitesService } from '@services';

export const createSite: AuthAppController<'Site', 'Site'> = async (req) => {
  const params = {
    ...req.body,
    businessId: req.user.id,
  };
  await SitesService.createSite(params);
  return { success: true };
};
