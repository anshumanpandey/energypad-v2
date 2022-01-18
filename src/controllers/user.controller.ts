import { AppModels, AuthAppController, AuthGetAppController } from '@types';
import { UserService, SitesService, UtilityService } from '@services';
import { ApiError } from '@lib';
import { getSinglePropArr } from '@utils';

export const updateUser: AuthAppController<'UpdateUser', 'UpdateUser'> = async (req) => {
  const { ...registerData } = req.body;

  await UserService.updateUser({ ...registerData, id: req.user.id });

  return { success: true };
};

export const getMet: AuthGetAppController<'GetUser'> = async (req) => {
  const user = await UserService.getUserBy({ id: req.user.id });
  if (!user) return new ApiError('User not found');

  return user;
};

export const saveEnergy: AuthAppController<'SaveBusinessEnergy', 'SaveBusinessEnergy'> = async (req) => {
  const [siteFound] = await SitesService.findBy({ id: req.body.siteId });
  if (!siteFound) {
    return new ApiError('Site not found');
  }
  const records = req.body.records;

  const getFuelSourceIds = (i: { fuelSourceId: number }) => i.fuelSourceId;
  const fuelIds = Array.from(new Set(records.map(getFuelSourceIds)).values());
  const fuels = await UtilityService.findFuelBy({ fuelSourceId: fuelIds });
  if (fuels.length !== fuelIds.length) {
    return new ApiError('Fuel not found');
  }

  const getFuelUseIds = (i: { usedInId: number[] }) => i.usedInId;
  const usesIds = Array.from(new Set(records.map(getFuelUseIds)).values()).flat();
  const uses = await UtilityService.findFuelUseBy({ id: usesIds });
  if (uses.length !== usesIds.length) {
    return new ApiError('Fuel Use not found');
  }
  await UserService.saveEnergy(req.body);

  return { success: true };
};

export const getBusinessEnergy: AuthGetAppController<'GetBusinessEnergy'> = async (req) => {
  const energies = await UserService.getBusinessEnergies<{ siteId: number } & AppModels['BusinessEnergy']>(
    {
      businessId: req.user.id,
    },
    { includeSiteId: true },
  );
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

export const setFloors: AuthAppController<'SetFloors', 'SetFloors'> = async (req) => {
  await UserService.setFloors({
    floors: req.body,
    businessId: req.user.id,
  });

  return { success: true };
};

export const getBusinessFloors: AuthGetAppController<'GetFloors'> = async (req) => {
  const floors = await UserService.getFloorsBy({
    businessId: req.user.id,
  });

  return floors;
};
