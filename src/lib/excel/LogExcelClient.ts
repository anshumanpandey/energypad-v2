import { SitesService } from '@services';
import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';
import { findFuelBy } from '../../services/utility.service';
import { AppModels } from '../../types/types';
import { ApiError } from '../ApiError';

export const getLogData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  const utilityConsumption: Awaited<ReturnType<typeof getRows>>[] = [];
  const promises = [];

  for (let i = 0, len = workbook.worksheets.length; i < len; i++) {
    const worksheet = workbook.worksheets[i];
    const p = getRows(worksheet).then((rows) => {
      utilityConsumption.push(rows);
    });
    promises.push(p);
  }

  await Promise.all(promises);

  return utilityConsumption.flat();
};

const getRows = async (Worksheet: Worksheet) => {
  const rows: AppModels['EnergyLog'][] = [];

  const startDateCol = Worksheet.columns[1].values;
  const endDateCol = Worksheet.columns[2].values;
  const commentsCol = Worksheet.columns[3].values;
  const operationCol = Worksheet.columns[4].values;
  const siteIdCol = Worksheet.columns[5].values;
  const usedInIdCol = Worksheet.columns[6].values;

  const names = Array.from(
    new Set(
      (siteIdCol || [])
        .slice(2)
        .map((c) => c?.toString() || '')
        .filter((c) => c !== ''),
    ).values(),
  );

  const fuels = Array.from(
    new Set(
      (usedInIdCol || [])
        .slice(2)
        .map((c) => c?.toString() || '')
        .filter((c) => c !== ''),
    ).values(),
  );
  const [sites, fuelsRecords] = await Promise.all([SitesService.findBy({ name: names }), findFuelBy({ names: fuels })]);

  for (let i = 1, len = Worksheet.columns.length; i < len; i++) {
    if (!startDateCol) break;
    if (!endDateCol) break;
    if (!commentsCol) break;
    if (!operationCol) break;
    if (!siteIdCol) break;
    if (!usedInIdCol) break;

    for (let a = 2, len = 13; a <= len; a++) {
      const startDateCell = startDateCol[a];
      const endDateCell = endDateCol[a];
      const commentCell = commentsCol[a];
      const operationCell = operationCol[a];
      const siteRecord = sites.find((s) => s.name === siteIdCol[a]);
      const usedInIdRecord = fuelsRecords.find((s) => s.source === usedInIdCol[a]);

      if (!startDateCell) break;
      if (!endDateCell) break;
      if (!commentCell) break;
      if (!operationCell) break;
      if (!siteRecord) break;
      if (!usedInIdRecord) break;

      if (usedInIdRecord.id === undefined) {
        throw new ApiError('Use not found');
      }

      const r = {
        siteId: siteRecord.id,
        usedInId: usedInIdRecord.id,
        startDate: formatISO(startDateCell as Date).split('T')[0],
        endDate: formatISO(endDateCell as Date).split('T')[0],
        comments: commentCell.toString(),
        operation: operationCell.toString(),
      };

      rows.push(r);
    }
  }

  return rows;
};

const readExcelFile = async (file: string | Buffer) => {
  const workbook = new Workbook();
  if (typeof file === 'string') {
    await workbook.xlsx.readFile(file);
  } else {
    await workbook.xlsx.load(file);
  }
  return workbook;
};
