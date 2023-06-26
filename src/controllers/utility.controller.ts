import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService, SitesService, UserService, ConversionUnitService } from '@services';
import { ApiError, ExcelClient, DB } from '@lib';
import { DbUtils, MathUtils } from '@utils';
import { ulid } from 'ulid';

export const addConsumption: AuthAppController<'AddFuelSourceConsumption', 'AddFuelSourceConsumption'> = async (
  req,
) => {
  const fuelSourcesToFind = req.body.map((i) => i.fuelSourceId);
  const sitesToFind = req.body.map((i) => i.siteId);
  const [fuelFound, siteFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId: fuelSourcesToFind }),
    SitesService.findBy({ id: sitesToFind }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (siteFound.length === 0) {
    return new ApiError('Site not found');
  }

  await UtilityService.deleteConsumptionBy({
    fuelSourceId: fuelSourcesToFind,
    siteId: sitesToFind,
    month: req.body.map((i) => DbUtils.stringDateToDate(i.date)),
  });

  const conversionFn = await ConversionUnitService.buildConversionFnForSite({ siteId: sitesToFind });
  const mapRecords = (r: typeof req.body[0]) => {
    return {
      ...r,
      consumption: r.consumption,
    };
  };
  await UtilityService.addConsumptionToUtility(req.body.map(mapRecords));

  return { success: true };
};

export const addEmission: AuthAppController<'AddFuelSourceEmission', 'AddFuelSourceEmission'> = async (req) => {
  const siteToFind = Array.from(new Set(req.body.map((i) => i.siteId)));
  const fuelSourceToFind = Array.from(new Set(req.body.map((i) => i.fuelSourceId)));
  const years = Array.from(new Set(req.body.map((i) => i.date)));

  const [fuelFound, sitesFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId: fuelSourceToFind }),
    SitesService.findBy({ id: siteToFind }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (sitesFound.length !== siteToFind.length) {
    return new ApiError('Site not found');
  }

  return DB.transaction(async (txr) => {
    try {
      await UtilityService.deleteEmissionsBy(
        {
          siteId: siteToFind,
          fuelSourceId: fuelSourceToFind,
          date: years,
        },
        { txr },
      );
      await UtilityService.addUtilityEmissions(req.body, { txr });

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof Error && e.toString().includes('utilityemissions_date_siteid_fuelsourceid_unique')) {
        return new ApiError('There cannot be more than one row where (siteId + fuelSource + date) are the same');
      }
      throw e;
    }
  });
};

export const addMonitoring: AuthAppController<'AddFuelSourceMonitoring', 'AddFuelSourceMonitoring'> = async (req) => {
  const siteToFind = Array.from(new Set(req.body.map((i) => i.siteId)));
  const fuelSourceToFind = Array.from(new Set(req.body.map((i) => i.fuelSourceId)));
  const years = Array.from(new Set(req.body.map((i) => i.date)));

  const [fuelFound, sitesFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId: fuelSourceToFind }),
    SitesService.findBy({ id: siteToFind }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (sitesFound.length !== siteToFind.length) {
    return new ApiError('Site not found');
  }

  return DB.transaction(async (txr) => {
    try {
      await UtilityService.deleteEmissionsBy(
        {
          siteId: siteToFind,
          fuelSourceId: fuelSourceToFind,
          date: years,
        },
        { txr },
      );
      await UtilityService.addMonitoringToUtility(req.body, { txr });

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof Error && e.toString().includes('utilityemissions_date_siteid_fuelsourceid_unique')) {
        return new ApiError('There cannot be more than one row where (siteId + fuelSource + date) are the same');
      }
      throw e;
    }
  });
};

export const importLog: AuthAppController<'UtilityFileImport', 'UtilityFileImport'> = async (req) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getLogData(excelFile.buffer);

  if (data instanceof ApiError) {
    return data;
  }
  if (data.length === 0) {
    return new ApiError('No data was imported');
  }

  await UserService.saveLog(data);

  return { success: true };
};

export const importFile: AuthAppController<'LogFileImport', 'LogFileImport'> = async (req) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getUtilityData(excelFile.buffer);

  if (data instanceof ApiError) return data;

  return DB.transaction(async (txr) => {
    const consumptionQuries = data.consumptions.map(async (i) => {
      const { fuelUses, ...data } = i;

      const recordId = ulid();
      await txr('UtilityConsumptions').insert({ ...data, id: recordId });
      const usesData = fuelUses.map((fu) => ({ usedInId: fu, consumptionId: recordId }));
      await txr('UtilityConsumptionsUse').insert(usesData);
    });

    const emissionsQueries = data.emissions.map(async (i) => {
      const { fuelUses, ...data } = i;

      const [recordId] = await txr('UtilityEmissions').insert(data).returning('id');
      const usesData = fuelUses.map((fu) => ({ usedInId: fu, emissionId: recordId.id }));
      await txr('UtilityEmissionsUse').insert(usesData);
    });

    const targetConsumptionQueries = data.targetConsumption.map(async (i) => {
      const { fuelUnit, targetValue, ...data } = i;

      const [recordId] = await txr('TargetConsumption').insert(data).returning('id');
      await txr('TargetConsumptionFuelConversion').insert({ targetValue, fuelUnit, targetConsumptionId: recordId.id });
    });
    await Promise.all(consumptionQuries.concat(emissionsQueries).concat(targetConsumptionQueries));

    return { success: true };
  });
};

export const getSavingTips: AuthGetAppController<'GetSavingTips'> = async () => {
  const tips = await UtilityService.getSavingTips();
  return tips;
};

export const getFuelSources: AuthGetAppController<'GetFuelSources'> = async () => {
  const tips = await UtilityService.getFuelSources();
  return tips;
};

export const getUses: AuthGetAppController<'GetUsedIn', '/api/utility/fuelUse'> = async (req) => {
  const tips = await UtilityService.findFuelUseBy({ names: req.query.names?.split(',') });
  return tips;
};

export const getConsumptions: AuthGetAppController<'GetConsumptions', '/api/utility/consumptions'> = async (req) => {
  let date = undefined;

  if (req.query.year && req.query.month) {
    date = new Date(MathUtils.toInt(req.query.year), MathUtils.toInt(req.query.month), 1);
  }
  const params: UtilityService.GetConsumptionsParams = {
    forMonth: date,
    forYear: date,
    siteId: req.query.siteId ? parseInt(req.query.siteId) : undefined,
    businessId: req.user.id,
  };
  const consumptions = await UtilityService.getConsumptions(params);
  return consumptions;
};

export const getEmissions: AuthGetAppController<'GetEmissions', '/api/utility/emissions'> = async (req) => {
  let forYear = undefined;

  if (req.query.year) {
    forYear = new Date(MathUtils.toInt(req.query.year), 0, 1);
  }
  const params: UtilityService.GetEmissionsParams = {
    forYear,
    siteId: req.query.siteId ? parseInt(req.query.siteId) : undefined,
    businessId: req.user.id,
  };
  const consumptions = await UtilityService.getEmissions(params);
  return consumptions;
};

//TODO: generate types for this route
export const getMonitoring = async (req: any) => {
  const params = {
    month: MathUtils.toInt(req.query.month),
    year: MathUtils.toInt(req.query.year),
    siteId: MathUtils.toInt(req.query.siteId),
    businessId: req.user.id,
  };
  const consumptions = await UtilityService.getMonitoring(params);
  return consumptions;
};

//TODO: generate types for this route
export const importUtilityEmissionFromFile = async (req: any) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const [sites, uses, fuels] = await Promise.all([
    SitesService.findBy(),
    UtilityService.findFuelUseBy(),
    UtilityService.findFuelBy(),
  ]);

  const [consumptions, emissions, monitoring] = await Promise.all([
    ExcelClient.extractConsumptionData(excelFile.buffer, { sites, uses, fuels }),
    ExcelClient.extractEmissionsData(excelFile.buffer, { sites, fuels }),
    ExcelClient.extractTargetData(excelFile.buffer, { sites, fuels }),
  ]);

  if (consumptions instanceof ApiError) {
    return consumptions;
  }
  if (emissions instanceof ApiError) {
    return consumptions;
  }
  if (monitoring instanceof ApiError) {
    return consumptions;
  }

  return DB.transaction(async (txr) => {
    try {
      await Promise.all([
        UtilityService.upsertConsumptionToUtility(consumptions, { txr }),
        UtilityService.upsertEmissions(emissions, { txr }),
        UtilityService.upsertMonitoring(monitoring, { txr }),
      ]);
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.toString().includes('utilityconsumptions_date_siteid_fuelsourceid_unique')) {
          return new ApiError(
            'Duplicated values found on Consumption. There cannot be more than one row where (siteId + fuelSource + date) are the same',
          );
        } else if (e.toString().includes('utilitymonitoring_date_siteid_fuelsourceid_unique')) {
          return new ApiError(
            'Duplicated values found on Target. There cannot be more than one row where (siteId + fuelSource + date) are the same',
          );
        } else if (e instanceof Error && e.toString().includes('utilityemissions_date_siteid_fuelsourceid_unique')) {
          return new ApiError(
            'Duplicated values found on Emissions. There cannot be more than one row where (siteId + fuelSource + date) are the same',
          );
        }
      } else {
        throw e;
      }
      throw e;
    }
  });
};
