import { AuthAppController, AuthGetAppController } from '@types';
import { UserService, SitesService, UtilityService } from '@services';
import { ApiError, DB } from '@lib';
import { getSinglePropArr } from '@utils';

export const updateUser: AuthAppController<'UpdateUser', 'UpdateUser'> = async (req) => {
  const { patterns, ...registerData } = req.body;

  return DB.transaction(async (txr) => {
    await UserService.updateUser({ ...registerData, id: req.user.id }, { txr });

    if (patterns && patterns.length !== 0) {
      const mapSiteId = (r: typeof patterns[0]) => r.siteId;
      const sites = await SitesService.findBy({ id: patterns.map(mapSiteId), businessId: req.user.id });
      if (sites.length !== patterns.length) {
        throw new ApiError('Site not found');
      }
      await UserService.savePattern(
        {
          businessId: req.user.id,
          patterns,
        },
        { txr },
      );
    }
  })
    .then(() => {
      return { success: true };
    })
    .catch((err) => {
      throw err;
    });
};

export const getMet: AuthGetAppController<'GetUser'> = async (req) => {
  const user = await UserService.getUserBy({ id: req.user.id });
  if (!user) return new ApiError('User not found');

  return user;
};

export const saveEnergy: AuthAppController<'SaveBusinessEnergy', 'SaveBusinessEnergy'> = async (req) => {
  const [siteFound] = await SitesService.findBy({ id: req.body.siteId, businessId: req.user.id });
  if (!siteFound) {
    return new ApiError('Site not found');
  }
  const [fuelFound] = await UtilityService.findFuelBy({ usedInId: req.body.usedInId });
  if (!fuelFound) {
    return new ApiError('Fuel not found');
  }
  await UserService.saveEnergy({
    fuelSourceId: fuelFound.id,
    ...req.body,
  });

  return { success: true };
};

export const getBusinessEnergy: AuthGetAppController<'GetBusinessEnergy'> = async (req) => {
  const energies = await UserService.getBusinessEnergies({ businessId: req.user.id });
  return energies;
};

export const addLog: AuthAppController<'AddLog', 'AddLog'> = async (req) => {
  const [siteFound] = await SitesService.findBy({ id: req.body.siteId, businessId: req.user.id });
  if (!siteFound) {
    return new ApiError('Site not found');
  }
  await UserService.saveLog(req.body);
  return { success: true };
};

export const setTenants: AuthAppController<'SetTenants', 'SetTenants'> = async (req) => {
  const sitesIds = Array.from(
    new Set(getSinglePropArr({ arr: req.body, prop: 'siteId' }).map((i) => Number(i))).values(),
  );
  const sites = await SitesService.findBy({
    id: sitesIds,
    businessId: req.user.id,
  });
  if (sites.length !== sitesIds.length) {
    return new ApiError('Site not found');
  }
  await UserService.setTenants({
    businessId: req.user.id,
    tenants: req.body,
  });
  return { success: true };
};

export const setReviews: AuthAppController<'SetReviews', 'SetReviews'> = async (req) => {
  const sitesIds = Array.from(
    new Set(getSinglePropArr({ arr: req.body, prop: 'siteId' }).map((i) => Number(i))).values(),
  );
  const sites = await SitesService.findBy({
    id: sitesIds,
    businessId: req.user.id,
  });
  if (sites.length !== sitesIds.length) {
    return new ApiError('Site not found');
  }
  await UserService.setReviews({
    businessId: req.user.id,
    reviews: req.body,
  });
  return { success: true };
};

export const setProgrammes: AuthAppController<'SetProgrammes', 'SetProgrammes'> = async (req) => {
  const sitesIds = Array.from(
    new Set(getSinglePropArr({ arr: req.body, prop: 'siteId' }).map((i) => Number(i))).values(),
  );
  const sites = await SitesService.findBy({
    id: sitesIds,
    businessId: req.user.id,
  });
  if (sites.length !== sitesIds.length) {
    return new ApiError('Site not found');
  }
  await UserService.setProgrammes({
    businessId: req.user.id,
    programmes: req.body,
  });
  return { success: true };
};

export const getSites: AuthGetAppController<'GetSites'> = async (req) => {
  const sites = await SitesService.findBy({
    businessId: req.user.id,
  });

  return sites;
};
