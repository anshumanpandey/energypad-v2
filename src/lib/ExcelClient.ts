import { Workbook, Worksheet } from 'exceljs';

export const getUtilityData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  const utilityConsumption = [];

  for (let i = 0, len = workbook.worksheets.length; i < len; i++) {
    const worksheet = workbook.worksheets[i];
    const rows = getRows(worksheet);
    const utilityName = worksheet.name;
    utilityConsumption.push({
      utilityName,
      rows,
    });
  }

  return utilityConsumption;
};

const getRows = (Worksheet: Worksheet) => {
  const rows = [];

  for (let i = 1, len = Worksheet.columns.length; i < len; i++) {
    const colValues = Worksheet.columns[i].values;

    if (!colValues) break;

    const year = colValues[1]?.toString();

    const months: { month: string; value: string }[] = [];

    for (let a = 1, len = 12; a <= len; a++) {
      const currentCell = colValues[a + 1];

      const month = ('0' + a).slice(-2);
      const monthVal = currentCell;
      if (monthVal) {
        months.push({ month, value: monthVal.toString() });
      }
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
