import { AppModels, AuthAppController, AuthGetAppController } from '@types';
import { UserService, SitesService, UtilityService } from '@services';
import { ApiError, DB, ExcelClient } from '@lib';
import { getSinglePropArr, MathUtils, DbUtils } from '@utils';
import { encryptPassword } from '@utils';
import { FindByParams } from '../services/sites.service';

export const updateUser: AuthAppController<'UpdateUser', 'UpdateUser'> = async (req) => {
  const registerData = req.body;
  const txr = await DbUtils.createTransaction();

  try {
    const { floors, ...data } = registerData;

    const userRecord = { ...data, id: req.user.id };
    if (data.password) {
      const password = await encryptPassword(data.password);
      userRecord.password = password;
    }
    await UserService.updateUser(userRecord, { txr });

    if (floors && floors.length > 0) {
      await UserService.setFloors({ floors: floors, businessId: req.user.id }, { txr });
    }

    await txr.commit();
    return { success: true };
  } catch (err) {
    await txr.rollback();
    if (err instanceof ApiError) {
      return err;
    } else {
      throw err;
    }
  }
};

export const getMet: AuthGetAppController<'GetUser'> = async (req) => {
  const data = await UserService.getUserBy({ id: req.user.id });
  if (!data) return new ApiError('User not found');

  const { password, ...user } = data;

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
  await UserService.saveLog([req.body]);
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

export const getSites: AuthGetAppController<'GetSites', '/api/business/sites'> = async (req) => {
  const { fsi } = req.query;

  const params: FindByParams = {
    businessId: req.user.id,
  };

  if (fsi) {
    params.fuelSourceIdUsedInConsumption = MathUtils.toInt(fsi);
  }
  const sites = await SitesService.findBy(params);

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

export const savePattenrs: AuthAppController<'SaveBusinessPattern', 'SaveBusinessPattern'> = async (req) => {
  await UserService.deletePatters({
    businessId: req.user.id,
    siteId: req.body.map((i) => i.siteId),
  });
  await UserService.savePattern({
    businessId: req.user.id,
    patterns: req.body,
  });

  return { success: true };
};

export const getPatterns: AuthGetAppController<'GetPatterns', '/api/business/patterns'> = async (req) => {
  const params = {
    businessId: req.user.id,
    siteId: undefined as undefined | number,
  };

  if (req.query?.siteId) {
    params.siteId = MathUtils.toInt(req.query.siteId);
  }

  const patterns = await UserService.getPatterns(params);

  return patterns;
};

export const getLogs: AuthGetAppController<'GetLogs', '/api/business/logs'> = async (req) => {
  const monthDate = new Date(MathUtils.toInt(req.query.year), MathUtils.toInt(req.query.month), 1);
  const params = {
    businessId: req.user.id,
    siteId: MathUtils.toInt(req.query.siteId),
    forMonth: monthDate,
  };

  const tenantsParams = {
    siteId: MathUtils.toInt(req.query.siteId),
    year: monthDate.getFullYear(),
    month: monthDate.getMonth(),
  };

  const [logs, tenants] = await Promise.all([UserService.getLogs(params), UserService.getTenantsBy(tenantsParams)]);

  return { logs, tenants };
};

export const importFile: AuthAppController<'FileImportBusiness', 'FileImportBusiness'> = async (req) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getBusinessData(excelFile.buffer);
  const sites = await ExcelClient.getSitesData(excelFile.buffer);

  if (data instanceof ApiError) return data;
  if (sites instanceof ApiError) return sites;

  await DB.transaction(async (trx) => {
    try {
      const [r] = await DB('Businesses').insert(data[0]).transacting(trx).returning('id');
      if (sites.length !== 0) {
        await DB('Sites')
          .insert(sites.map((s) => ({ ...s, businessId: r.id })))
          .transacting(trx);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw e.toString().includes('businesses_businessname_unique') ? new ApiError('Duplicated business name') : e;
      }
      throw e;
    }
  });

  return { success: true };
};

export const importTenants: AuthAppController<'FileImportBusinessTenants', 'FileImportBusinessTenants'> = async (
  req,
) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getTenantData(excelFile.buffer);
  if (data instanceof ApiError) return data;

  const isString = (str: string | undefined): str is string => {
    return typeof str === 'string';
  };

  const sitesId = Array.from(new Set(data.map((i) => i.siteId)).values())
    .filter(isString)
    .map(MathUtils.toInt);
  const sites = await SitesService.findBy({ id: sitesId });

  if (sitesId.length !== sites.length) {
    return new ApiError('Site not found');
  }

  await DB('BusinessTenant').insert(data);

  return { success: true };
};

export const importPatterns: AuthAppController<'FileImportBusinessPatterns', 'FileImportBusinessPatterns'> = async (
  req,
) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getPatternsData(excelFile.buffer);
  if (data instanceof ApiError) return data;

  const isString = (str: string | undefined): str is string => {
    return typeof str === 'string';
  };

  const sitesId = Array.from(new Set(data.map((i) => i.siteId)).values())
    .filter(isString)
    .map(MathUtils.toInt);

  const usedInIds = Array.from(new Set(data.map((i) => i.usedInId)).values())
    .filter(isString)
    .map(MathUtils.toInt);

  const [usedIn, sites] = await Promise.all([
    UtilityService.findFuelUseBy({ id: usedInIds }),
    SitesService.findBy({ id: sitesId }),
  ]);

  if (sitesId.length !== sites.length) {
    return new ApiError('Site not found');
  }

  if (usedInIds.length !== usedIn.length) {
    return new ApiError('Site not found');
  }

  await DB('BusinessPatterns').insert(data);

  return { success: true };
};
