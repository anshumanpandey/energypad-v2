import { ApiError } from '@lib';
import { encryptPassword } from '@utils';
import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';

const validColums = [
  { name: 'businessName', validate: { required: true } },
  { name: 'businessType', validate: { required: true } },
  { name: 'businessService', validate: { required: true } },
  { name: 'siteName', validate: { required: true } },
  { name: 'buildingName', validate: { required: true } },
  { name: 'contactName', validate: { required: true } },
  { name: 'position', validate: { required: true } },
  { name: 'phoneNumber', validate: { required: true } },
  { name: 'email', validate: { required: true } },
  { name: 'town', validate: { required: true } },
  { name: 'postCode', validate: { required: true } },
  {
    name: 'subscriptionDate',
    validate: { required: true },
    parseValue: async (val: string) => {
      return formatISO(new Date(val)).split('T')[0];
    },
  },
  {
    name: 'holydayDate',
    validate: { required: false },
    parseValue: async (val?: string) => {
      return val ? formatISO(new Date(val))[0] : undefined;
    },
  },
  { name: 'totalArea', validate: { required: true } },
  { name: 'totalPopulation', validate: { required: true } },
  { name: 'countryId', validate: { required: true } },
  { name: 'stateId', validate: { required: true } },
  {
    name: 'password',
    validate: { required: true },
    parseValue: (val: string) => {
      return encryptPassword(val);
    },
  },
];

export const getBusinessData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const worksheet = workbook.worksheets[0];
  const rows = await getRows(worksheet);
  if (rows instanceof ApiError) return rows;

  return rows;
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

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
              .parseValue(colVal)
              .then((val) => {
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
