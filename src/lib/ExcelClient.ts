import { Workbook, Worksheet } from 'exceljs';

export const getUtilityData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  const utilityConsumption = [];

  for (let i = 0, len = workbook.worksheets.length; i < len; i++) {
    const worksheet = workbook.worksheets[i];
    const rows = getRows(worksheet);
    const year = worksheet.name;
    utilityConsumption.push({
      rows,
      year,
    });
  }

  return utilityConsumption;
};

const getRows = (Worksheet: Worksheet) => {
  const rows = [];

  for (let i = 1, len = Worksheet.columns.length; i < len; i++) {
    const consumptionCol = Worksheet.columns[1].values;
    const costCol = Worksheet.columns[2].values;
    const siteCol = Worksheet.columns[3].values;
    const usedInCol = Worksheet.columns[4].values;

    if (!consumptionCol) break;
    if (!costCol) break;
    if (!siteCol) break;
    if (!usedInCol) break;

    const year = Worksheet.name;

    const months: { month: string; consumption: string; cost: number; siteId: number; usedInId: number }[] = [];

    for (let a = 1, len = 12; a <= len; a++) {
      const consumptionCell = consumptionCol[a + 1];
      const costCell = costCol[a + 1];
      const siteCell = siteCol[a + 1];
      const usedInCell = usedInCol[a + 1];

      const month = ('0' + a).slice(-2);
      if (!consumptionCell) {
        break;
      }
      if (!costCell) {
        break;
      }
      if (!siteCell) {
        break;
      }
      if (!usedInCell) {
        break;
      }

      months.push({
        month,
        consumption: consumptionCell.toString(),
        cost: parseInt(costCell.toString(), 10),
        siteId: parseInt(siteCell.toString(), 10),
        usedInId: parseInt(usedInCell.toString(), 10),
      });
    }

    rows.push({
      year,
      months,
    });
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
