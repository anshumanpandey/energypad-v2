import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService } from '@services';
import { ApiError, ExcelClient } from '@lib';
import { AddConsumptionToUtilityParam } from '../services/utility.service';

export const addConsumption: AuthAppController<'AddFuelSourceConsumption', 'AddFuelSourceConsumption'> = async (
  req,
) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);
  const found = await UtilityService.findFuelBy({ fuelSourceId });
  if (found.length === 0) {
    return new ApiError('Utility to add not found');
  }

  const params = {
    ...req.body,
    businessId: req.user.id,
    fuelSourceId,
  };

  await UtilityService.addConsumptionToUtility(params);

  return { success: true };
};

export const addEmission: AuthAppController<'AddFuelSourceEmission', 'AddFuelSourceEmission'> = async (req) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);
  const found = await UtilityService.findFuelBy({ fuelSourceId: fuelSourceId });
  if (found.length === 0) {
    return new ApiError('Foul Source to add not found');
  }

  const mapEmission = (r: typeof req.body[0]) => {
    return {
      ...r,
      fuelSourceId,
      businessId: req.user.id,
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
          businessId: req.user.id,
          date: `${yearEntry.year}-${currentMonth.month}-01`,
          consumption: parseInt(currentMonth.consumption, 10),
          cost: currentMonth.cost,
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
