import { ApiError } from '@lib';
import { SitesService } from '@services';
import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';
import { findFuelBy } from '../../services/utility.service';

export const getPatternsData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const worksheet = workbook.worksheets[0];
  const rows = await getRows(worksheet);
  if (rows instanceof ApiError) return rows;

  return rows;
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

  const usedInIdCol = Worksheet.columns[4].values;
  const siteIdCol = Worksheet.columns[5].values;

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

  const validColums = [
    {
      name: 'startDate',
      validate: { required: true },
      parseValue: async (val: string) => {
        return formatISO(new Date(val)).split('T')[0];
      },
    },
    {
      name: 'endDate',
      validate: { required: true },
      parseValue: async (val: string) => {
        return formatISO(new Date(val)).split('T')[0];
      },
    },
    { name: 'consumption', validate: { required: true } },
    { name: 'daysOnYear', validate: { required: true } },
    {
      name: 'usedInId',
      parseValue: async (val: string) => {
        return fuelsRecords.find((f) => f.source === val)?.id;
      },
      validate: { required: true },
    },
    {
      name: 'siteId',
      parseValue: async (val: string) => {
        return sites.find((s) => val === s.name)?.id;
      },
      validate: { required: true },
    },
  ];

  const rowAmount = Worksheet.rowCount;
  root_loop: for (let i = 2; i <= rowAmount; i++) {
    const singleRow: Record<string, string | undefined> = {};
    const promises = [];
    loop: for (let a = 0, len = validColums.length; a < len; a++) {
      const validCol = validColums[a];
      const colIdx = a;
      const col = Worksheet.columns[colIdx].values;
      if (!col) continue loop;
      if (col[1]?.toString() !== validCol.name) {
        return new ApiError('Wrong format');
      }

      const colVal = col[i]?.toString();

      if (validCol.validate.required === true) {
        if (colVal === undefined) continue root_loop;
      }

      const p = new Promise<void>((resolve, reject) => {
        if (validCol.parseValue) {
          if (colVal) {
            validCol
              ?.parseValue(colVal)
              .then((val: any) => {
                singleRow[validCol.name] = val;
              })
              .then(resolve)
              .catch(reject);
          } else {
            singleRow[validCol.name] = undefined;
            resolve();
          }
        } else {
          singleRow[validCol.name] = colVal;
          resolve();
        }
      });
      promises.push(p);
    }

    await Promise.all(promises);

    rows.push(singleRow);
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
