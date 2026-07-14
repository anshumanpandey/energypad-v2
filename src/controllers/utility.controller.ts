import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService, SitesService, UserService } from '@services';
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

  await UtilityService.addConsumptionToUtility(req.body);

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
    const consumptionQuries = data.consumptions.map((i) => {
      const recordId = ulid();
      return { ...i, id: recordId };
    });

    const emissionsQueries = data.emissions.map((i) => {
      const { fuelUses, ...data } = i;

      return data;
    });

    const targetConsumptionQueries = data.targetConsumption.reduce(
      (json, next) => {
        const { fuelUnit, targetValue, targetCarbon, ...data } = next;

        const recordId = ulid();
        const row = { id: recordId, ...data };
        json.consumption.push(row);
        json.fuelConversion.push({ targetValue, targetCarbon, fuelUnit, targetConsumptionId: recordId });
        return json;
      },
      { consumption: [] as any[], fuelConversion: [] as any[] },
    );

    const driverEnums = ['R', 'NR'];

    const driverData = data.driversData
      .reduce((list, next) => {
        const consumptionList = [];

        const heating = next.heating.toString().toUpperCase();
        if (driverEnums.includes(heating)) {
          consumptionList.push({ driver: heating, category: 'Heating', siteId: next.siteId });
        }
        const cooling = next.cooling.toString().toUpperCase();
        if (driverEnums.includes(cooling)) {
          consumptionList.push({ driver: cooling, category: 'Cooling', siteId: next.siteId });
        }
        const population = next.population.toString().toUpperCase();
        if (driverEnums.includes(population)) {
          consumptionList.push({ driver: population, category: 'Population', siteId: next.siteId });
        }
        const operatingHours = next.operatingHours.toString().toUpperCase();
        if (driverEnums.includes(operatingHours)) {
          consumptionList.push({ driver: operatingHours, category: 'OperatingHours', siteId: next.siteId });
        }
        const daylight = next.daylight.toString().toUpperCase();
        if (driverEnums.includes(daylight)) {
          consumptionList.push({ driver: daylight, category: 'Daylight', siteId: next.siteId });
        }
        const buildingSize = next.buildingSize.toString().toUpperCase();
        if (driverEnums.includes(buildingSize)) {
          consumptionList.push({ driver: buildingSize, category: 'BuildingSize', siteId: next.siteId });
        }

        return list.concat(consumptionList);
      }, [] as { driver: string; category: string; siteId: number | undefined }[])
      .flat();

    const results = await txr('TargetConsumption')
      .select()
      .whereIn(
        'siteId',
        targetConsumptionQueries.consumption.map((i) => i.siteId),
      )
      .whereIn(
        'fuelSourceId',
        targetConsumptionQueries.consumption.map((i) => i.fuelSourceId),
      );

    if (results.length > 0) {
      await txr('TargetConsumption')
        .del()
        .whereIn(
          'id',
          results.map((i) => i.id),
        );
    }

    if (driverData.length > 0) {
      await txr('UtilityToDriver')
        .del()
        .whereIn(
          'siteId',
          driverData.map((i) => i.siteId as number),
        );
    }

    await Promise.all(
      consumptionQuries.map((i) => {
        const year = i.date.split('-')[0];
        return txr('UtilityConsumptions')
          .del()
          .where({ siteId: i.siteId, fuelSourceId: i.fuelSourceId })
          .whereLike('date', `${year}-%`);
      }),
    );

    const queries = [
      txr('UtilityConsumptions')
        .insert(consumptionQuries)
        .onConflict(['date', 'fuelSourceId', 'siteId'])
        .merge(['consumption', 'conversionFactor', 'fuelUnit', 'vat', 'usedInId', 'population', 'workingHours']),
      txr('TargetConsumption').insert(targetConsumptionQueries.consumption),
      txr('TargetConsumptionFuelConversion').insert(targetConsumptionQueries.fuelConversion),
      txr('UtilityEmissions').insert(emissionsQueries).onConflict(['siteId', 'fuelSourceId', 'date']).merge(),
      txr('UtilityToDriver').insert(driverData).onConflict(['driver', 'category', 'siteId']).merge(),
      txr('BusinessPatterns')
        .insert(data.patternsData)
        .onConflict(['usedInId', 'siteId', 'startDate', 'endDate'])
        .merge(),
    ];

    await Promise.all(queries);

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
    siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
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
    siteId: req.query.siteId ? MathUtils.toInt(req.query.siteId) : undefined,
    businessId: req.user.id,
  };
  const consumptions = await UtilityService.getEmissions(params);
  return consumptions;
};

//TODO: generate types for this route
export const getMonitoring = async (req: any) => {
  const params: UtilityService.GetMonitoringParams = {
    businessId: req.user.id,
  };
  if (req.query.month) {
    params.month = MathUtils.toInt(req.query.month);
  }
  if (req.query.year) {
    params.year = MathUtils.toInt(req.query.year);
  }
  if (req.query.siteId) {
    params.siteId = MathUtils.toInt(req.query.siteId);
  }
  const consumptions = await UtilityService.getMonitoring(params);
  return consumptions;
};

const getDuplicatesForComsumption = (consumptions: any[]) => {
  const table = new Map<string, any[]>();
  for (let i = 0; i < consumptions.length; i++) {
    const item = consumptions[i];
    const uniqueIndex = `${item.date}-${item.siteId}-${item.fuelSourceId}-${item.usedInId}`;

    let found = table.get(uniqueIndex);
    if (found) {
      found = found.concat([item]);
      table.set(uniqueIndex, found);
    } else {
      table.set(uniqueIndex, [item]);
    }
  }

  return Array.from(table.values())
    .filter((i) => i.length > 1)
    .flat();
};

const getDuplicatesForEmissionOrTargets = (consumptions: any[]) => {
  const table = new Map<string, any[]>();
  for (let i = 0; i < consumptions.length; i++) {
    const item = consumptions[i];
    const uniqueIndex = `${item.date}-${item.siteId}-${item.fuelSourceId}`;

    let found = table.get(uniqueIndex);
    if (found) {
      found = found.concat([item]);
      table.set(uniqueIndex, found);
    } else {
      table.set(uniqueIndex, [item]);
    }
  }

  return Array.from(table.values())
    .filter((i) => i.length > 1)
    .flat();
};

const removeRowIdx = (c: any) => {
  const { rowIdx, ...record } = c;
  return record;
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

  const consumptions = await ExcelClient.extractConsumptionData(excelFile.buffer, { sites, uses, fuels });
  if (consumptions instanceof ApiError) {
    return consumptions;
  }

  const emissions = await ExcelClient.extractEmissionsData(excelFile.buffer, { sites, fuels, consumptions });
  if (emissions instanceof ApiError) {
    return emissions;
  }

  const monitoring = await ExcelClient.extractTargetData(excelFile.buffer, { sites, fuels });
  if (monitoring instanceof ApiError) {
    return monitoring;
  }

  return DB.transaction(async (txr) => {
    try {
      let duplicates = getDuplicatesForComsumption(consumptions);
      if (duplicates.length > 0) {
        return new ApiError(
          `Duplicated values found on Consumption. Check rows ${duplicates.map((i) => i.rowIdx).join(', ')}`,
        );
      }
      duplicates = getDuplicatesForEmissionOrTargets(emissions);
      if (duplicates.length > 0) {
        return new ApiError(
          `Duplicated values found on Emissions. Check rows ${duplicates.map((i) => i.rowIdx).join(', ')}`,
        );
      }
      duplicates = getDuplicatesForEmissionOrTargets(monitoring);
      if (duplicates.length > 0) {
        return new ApiError(
          `Duplicated values found on Targets. Check rows ${duplicates.map((i) => i.rowIdx).join(', ')}`,
        );
      }
      await Promise.all([
        UtilityService.upsertConsumptionToUtility(consumptions.map(removeRowIdx), { txr }),
        UtilityService.upsertEmissions(emissions.map(removeRowIdx), { txr }),
        UtilityService.upsertMonitoring(monitoring.map(removeRowIdx), { txr }),
      ]);
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.toString().includes('utilitymonitoring_date_siteid_fuelsourceid_unique')) {
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

export const saveTipsMapping: any = async (req: any) => {
  await UtilityService.mapEnergyTipToBusiness(req.body);
};

export const getBusinessTips: any = async (req: any) => {
  if (req.query.businessId === undefined) {
    return new ApiError('Missing businessId params');
  }

  const u = await UserService.getUserBy({ id: req.query.businessId });
  if (u === undefined) {
    return new ApiError('User not found');
  }

  const tips = await UtilityService.getBusinessTips(req.query);
  return tips;
};
