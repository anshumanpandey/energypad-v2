import { ApiError } from '@lib';
import { SitesService } from '@services';
import { Workbook, Worksheet } from 'exceljs';

type Record = {
  month: string;
  consumption: string;
  cost: number;
  totalCost: number;
  siteId: number;
  usedInId: number;
};
export const getUtilityData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  const utilityConsumption: { rows: { year: string; months: Record[] }[]; year: string }[] = [];
  const promises = [];

  for (let i = 0, len = workbook.worksheets.length; i < len; i++) {
    promises.push(
      new Promise<void>(async (resolve, rejected) => {
        const worksheet = workbook.worksheets[i];
        const rows = await getRows(worksheet);
        if (rows instanceof ApiError) {
          rejected(rows);
        } else {
          const year = worksheet.name;
          utilityConsumption.push({
            rows,
            year,
          });
          resolve();
        }
      }),
    );
  }

  return Promise.all(promises).then(() => {
    return utilityConsumption;
  });
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

  const consumptionCol = Worksheet.columns[1].values;
  const costCol = Worksheet.columns[2].values;
  const totalCostCol = Worksheet.columns[3].values;
  const siteCol = Worksheet.columns[4].values;
  const usedInCol = Worksheet.columns[5].values;

  if (!consumptionCol) return [];
  if (!costCol) return [];
  if (!totalCostCol) return [];
  if (!siteCol) return [];
  if (!usedInCol) return [];

  if (consumptionCol[1]?.toString() !== 'consumption') return new ApiError('Wrong format');
  if (costCol[1]?.toString() !== 'cost') return new ApiError('Wrong format');
  if (siteCol[1]?.toString() !== 'siteName') return new ApiError('Wrong format');
  if (usedInCol[1]?.toString() !== 'usedInId') return new ApiError('Wrong format');

  const year = Worksheet.name;

  const months: Record[] = [];

  const names = Array.from(
    new Set(
      siteCol
        .slice(2)
        .map((c) => c?.toString() || '')
        .filter((c) => c !== ''),
    ).values(),
  );
  const sites = await SitesService.findBy({ name: names });

  for (let a = 1, len = 12; a <= len; a++) {
    const consumptionCell = consumptionCol[a + 1];
    const costCell = costCol[a + 1];
    const totalCostCell = totalCostCol[a + 1];
    const siteRecord = sites.find((s) => s.name === siteCol[a + 1]);
    const usedInCell = usedInCol[a + 1];

    const month = ('0' + a).slice(-2);
    if (!consumptionCell) {
      break;
    }
    if (!costCell) {
      break;
    }
    if (!siteRecord) {
      break;
    }
    if (!usedInCell) {
      break;
    }

    months.push({
      month,
      consumption: consumptionCell.toString(),
      cost: parseInt(costCell.toString(), 10),
      totalCost: totalCostCell ? parseInt(totalCostCell.toString(), 10) : 0,
      siteId: siteRecord.id,
      usedInId: parseInt(usedInCell.toString(), 10),
    });
  }

  rows.push({
    year,
    months,
  });

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
