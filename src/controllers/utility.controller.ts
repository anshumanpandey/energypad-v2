import { AppController, AuthAppController } from '@types';
import { UtilityServices } from '@services';
import { ApiError, ExcelClient } from '@lib';
import { AddConsumptionToUtilityParam } from '../services/utility.service';

export const createUtility: AuthAppController<'CreateUtility'> = async (req) => {
  const data = {
    ...req.body,
    businessId: req.user.id,
  };
  await UtilityServices.create(data);

  return { success: true };
};

export const addEmission: AppController<'AddUtilityEmission'> = async (req) => {
  const utilityId = req.params.utilityId;
  const params = {
    ...req.body,
    utilityId: parseInt(utilityId, 10),
  };

  await UtilityServices.addConsumptionToUtility(params);

  return { success: true };
};

export const importFile: AuthAppController<'UtilityFileImport'> = async (req) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getUtilityData(excelFile.buffer);
  const utilities = await UtilityServices.findBy({ name: data.map((i) => i.utilityName), businessId: req.user.id });

  const dataToInsert: AddConsumptionToUtilityParam[] = [];
  for (let i = 0, len = data.length; i < len; i++) {
    const entry = data[i];
    const found = utilities.find((u) => u.name.toLocaleLowerCase() === entry.utilityName.toLocaleLowerCase());

    if (found) {
      for (let a = 0, len = entry.rows.length; a < len; a++) {
        const yearEntry = entry.rows[a];

        for (let m = 0, len = yearEntry.months.length; m < len; m++) {
          const currentMonth = yearEntry.months[m];
          dataToInsert.push({
            utilityId: found.id,
            date: `${yearEntry.year}-${currentMonth.month}-01`,
            consumption: parseInt(currentMonth.value, 10),
            cost: 0,
          });
        }
      }
    }
  }

  if (dataToInsert.length === 0) {
    return new ApiError('No data was imported');
  }

  await UtilityServices.addConsumptionToUtility(dataToInsert);

  return { success: true };
};
