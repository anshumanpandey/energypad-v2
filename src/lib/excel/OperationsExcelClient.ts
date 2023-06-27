import { ApiError } from '@lib';
import { SitesService } from '@services';
import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';
import { findFuelUseBy } from '../../services/utility.service';

export const getPatternsData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const worksheet = workbook.worksheets[0];
  const rows = await getRows(worksheet);
  if (rows instanceof ApiError) return rows;

  return rows;
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

  const usedInIdCol = Worksheet.columns[1].values;
  const siteIdCol = Worksheet.columns[0].values;

  const codes = Array.from(
    new Set(
      (siteIdCol || [])
        .slice(3)
        .map((c) => c?.toString() || '')
        .filter((c) => c !== ''),
    ).values(),
  );

  const uses = Array.from(
    new Set(
      (usedInIdCol || [])
        .slice(3)
        .map((c) => c?.toString() || '')
        .filter((c) => c !== ''),
    ).values(),
  );
  const [fuelsRecords, sites] = await Promise.all([findFuelUseBy({ names: uses }), SitesService.findBy({ codes })]);

  const validColums = [
    {
      name: 'Site Code',
      alias: 'siteId',
      validate: { required: true },
      parseValue: async (val: string) => {
        return sites.find((f) => f.code === val)?.id;
      },
    },
    {
      name: 'Energy  Demand',
      alias: 'usedInId',
      parseValue: async (val: string) => {
        return fuelsRecords.find((f) => f.use.toLowerCase() === val.toLowerCase())?.id;
      },
      validate: { required: true },
    },
    {
      name: 'Start Date',
      alias: 'startDate',
      validate: { required: true },
      parseValue: async (val: string) => {
        return formatISO(new Date(val)).split('T')[0];
      },
    },
    {
      name: 'End Date',
      alias: 'endDate',
      validate: { required: true },
      parseValue: async (val: string) => {
        return formatISO(new Date(val)).split('T')[0];
      },
    },
    {
      name: 'Temperature set point',
      validate: { required: false },
      alias: 'temperature',
      parseValue: async (val: string) => {
        return val === 'N/A' || val === '' ? undefined : val;
      },
    },
    { name: 'Days in the year', alias: 'daysOnYear', validate: { required: true } },
  ];

  const rowAmount = Worksheet.rowCount;
  root_loop: for (let i = 3; i <= rowAmount; i++) {
    const singleRow: Record<string, string | undefined> = {};
    const promises = [];
    loop: for (let a = 0, len = validColums.length; a < len; a++) {
      const validCol = validColums[a];
      const col = Worksheet.columns[a].values;
      if (!col) continue loop;
      if (col[2]?.toString() !== validCol.name) {
        return new ApiError('Wrong format');
      }

      const castedCol = col[i] as any;
      const colVal = castedCol?.result || castedCol?.text || castedCol?.toString();

      if (validCol.validate.required === true) {
        if (colVal === undefined) continue root_loop;
      }

      const p = new Promise<void>((resolve, reject) => {
        if (validCol.parseValue) {
          if (colVal) {
            validCol
              ?.parseValue(colVal)
              .then((val: any) => {
                singleRow[validCol?.alias || validCol.name] = val;
              })
              .then(resolve)
              .catch(reject);
          } else {
            singleRow[validCol?.alias || validCol.name] = undefined;
            resolve();
          }
        } else {
          singleRow[validCol?.alias || validCol.name] = colVal;
          resolve();
        }
      });
      promises.push(p);
    }

    await Promise.all(promises);

    rows.push(singleRow);
  }

  return rows.filter(
    (arr, index, self) =>
      index ===
      self.findIndex(
        (t) =>
          t.usedInId === arr.usedInId &&
          t.siteId === arr.siteId &&
          t.startDate === arr.startDate &&
          t.endDate === arr.endDate,
      ),
  );
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
