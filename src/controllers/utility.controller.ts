import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService } from '@services';
import { ApiError, ExcelClient } from '@lib';
import { AddConsumptionToUtilityParam } from '../services/utility.service';

export const createUtility: AuthAppController<'CreateUtility', 'CreateUtility'> = async (req) => {
  const data = {
    ...req.body,
    businessId: req.user.id,
  };
  await UtilityService.create(data);

  return { success: true };
};

export const getUtilities: AuthGetAppController<'GetUtilities', '/api/utility/'> = async (req) => {
  const utilities = await UtilityService.findBy({ businessId: req.user.id });
  return utilities;
};

export const addConsumption: AuthAppController<'AddUtilityConsumption', 'AddUtilityConsumption'> = async (req) => {
  const utilityId = req.params.utilityId;
  const found = await UtilityService.findBy({ id: parseInt(utilityId, 10), businessId: req.user.id });
  if (found.length === 0) {
    return new ApiError('Utility to add not found');
  }

  const params = {
    ...req.body,
    utilityId: parseInt(utilityId, 10),
  };

  await UtilityService.addConsumptionToUtility(params);

  return { success: true };
};

export const addEmission: AuthAppController<'AddUtilityEmission', 'AddUtilityEmission'> = async (req) => {
  const utilityId = req.params.utilityId;
  const found = await UtilityService.findBy({ id: parseInt(utilityId, 10), businessId: req.user.id });
  if (found.length === 0) {
    return new ApiError('Utility to add not found');
  }

  const mapEmission = (r: typeof req.body[0]) => {
    return {
      ...r,
      businessId: req.user.id,
    };
  };

  await UtilityService.setUtilityEmissions(req.body.map(mapEmission));

  return { success: true };
};

export const importFile: AuthAppController<'UtilityFileImport', 'UtilityFileImport'> = async (req) => {
  const excelFile = req.file;
  const id = (req.body as unknown as Record<string, string>).utilityId;
  const utilityId = parseInt(id, 10);
  if (!utilityId) return new ApiError('Missing utilityId');
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
          utilityId: utilityId,
          date: `${yearEntry.year}-${currentMonth.month}-01`,
          consumption: parseInt(currentMonth.consumption, 10),
          cost: currentMonth.cost,
          siteId: currentMonth.siteId,
          usedInId: currentMonth.usedInId,
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
