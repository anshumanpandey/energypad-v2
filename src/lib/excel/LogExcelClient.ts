import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';
import { SaveLogParams } from '../../services/user.service';

export const getLogData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  const utilityConsumption = [];

  for (let i = 0, len = workbook.worksheets.length; i < len; i++) {
    const worksheet = workbook.worksheets[i];
    const rows = getRows(worksheet);
    utilityConsumption.push(rows);
  }

  return utilityConsumption.flat();
};

const getRows = (Worksheet: Worksheet) => {
  const rows: SaveLogParams[] = [];

  for (let i = 1, len = Worksheet.columns.length; i < len; i++) {
    const startDateCol = Worksheet.columns[1].values;
    const endDateCol = Worksheet.columns[2].values;
    const commentsCol = Worksheet.columns[3].values;
    const operationCol = Worksheet.columns[4].values;
    const siteIdCol = Worksheet.columns[5].values;
    const usedInIdCol = Worksheet.columns[6].values;

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
      const siteIdCell = siteIdCol[a];
      const usedInIdCell = usedInIdCol[a];

      if (!startDateCell) break;
      if (!endDateCell) break;
      if (!commentCell) break;
      if (!operationCell) break;
      if (!siteIdCell) break;
      if (!usedInIdCell) break;

      const r = {
        siteId: parseInt(siteIdCell.toString(), 10),
        usedInId: parseInt(usedInIdCell.toString(), 10),
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
