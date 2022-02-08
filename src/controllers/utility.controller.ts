import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService, SitesService } from '@services';
import { ApiError, ExcelClient } from '@lib';
import { AddConsumptionToUtilityParam } from '../services/utility.service';

export const addConsumption: AuthAppController<'AddFuelSourceConsumption', 'AddFuelSourceConsumption'> = async (
  req,
) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);
  const [fuelFound, siteFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId }),
    SitesService.findBy({ id: req.body.siteId }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (siteFound.length === 0) {
    return new ApiError('Site not found');
  }

  const params = {
    ...req.body,
    fuelSourceId,
  };

  await UtilityService.addConsumptionToUtility(params);

  return { success: true };
};

export const addEmission: AuthAppController<'AddFuelSourceEmission', 'AddFuelSourceEmission'> = async (req) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);

  const siteToFind = Array.from(new Set(req.body.map((i) => i.siteId)));
  const [fuelFound, sitesFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId }),
    SitesService.findBy({ id: siteToFind }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (sitesFound.length !== siteToFind.length) {
    return new ApiError('Site not found');
  }

  const mapEmission = (r: typeof req.body[0]) => {
    return {
      ...r,
      fuelSourceId,
    };
  };

  await UtilityService.addUtilityEmissions(req.body.map(mapEmission));

  return { success: true };
};

export const importFile: AuthAppController<'UtilityFileImport', 'UtilityFileImport'> = async (req) => {
  const excelFile = req.file;
  const id = (req.body as unknown as Record<string, string>).fuelSource;
  const fuelSourceId = parseInt(id, 10);
  if (!fuelSourceId) return new ApiError('Missing fuelSourceId');
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getUtilityData(excelFile.buffer);

  const dataToInsert: AddConsumptionToUtilityParam[] = [];
  for (let i = 0, len = data.length; i < len; i++) {
    const entry = data[i];

    for (let a = 0, len = entry.rows.length; a < len; a++) {
      const yearEntry = entry.rows[a];

      for (let m = 0, len = yearEntry.months.length; m < len; m++) {
        const currentMonth = yearEntry.months[m];
        dataToInsert.push({
          fuelSourceId: fuelSourceId,
          date: `${yearEntry.year}-${currentMonth.month}-01`,
          consumption: parseInt(currentMonth.consumption, 10),
          cost: currentMonth.cost,
          siteId: currentMonth.siteId,
        });
      }
    }
  }

  if (dataToInsert.length === 0) {
    return new ApiError('No data was imported');
  }

  await UtilityService.addConsumptionToUtility(dataToInsert);

  return { success: true };
};

export const getSavingTips: AuthGetAppController<'GetSavingTips'> = async () => {
  const tips = await UtilityService.getSavingTips();
  return tips;
};

export const getFuelSources: AuthGetAppController<'GetFuelSources'> = async () => {
  const tips = await UtilityService.getFuelSources();
  return tips;
};

export const getEmissions: AuthGetAppController<'GetConsumptions'> = async (req) => {
  const consumptions = await UtilityService.getConsumptions({ businessId: req.user.id });
  return consumptions;
};
