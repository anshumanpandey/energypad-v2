import { ApiError, DB } from '@lib';
import { SitesService } from '@services';
import { encryptPassword } from '@utils';
import { formatISO } from 'date-fns';
import { Workbook, Worksheet } from 'exceljs';

export const getBusinessData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const worksheet = workbook.worksheets[0];
  const rows = await getRows(worksheet);
  if (rows instanceof ApiError) return rows;

  return rows;
};

export const getSitesData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const siteWorksheet = workbook.worksheets[1];
  const sites = getSitesRecords(siteWorksheet);

  const getEmails = (record: any) => record.businessEmail;
  const query = DB('Businesses').select(['id', 'email']).whereIn('email', sites.map(getEmails));
  const users = await query;
  const findUser = (businessEmail: string) => (item: any) => item.email === businessEmail;

  const reduceSites = (records: any, users: any[]) => {
    const rows = [];

    for (let i = 0; i < records.length; i++) {
      const { businessEmail, ...el } = records[i];

      const foundUser = users.find(findUser(businessEmail));

      if (foundUser) {
        rows.push({
          ...el,
          businessId: foundUser.id,
        });
      }
    }
    return rows;
  };

  return reduceSites(sites, users);
};

const isValidSiteRow = (recordToInsert: Record<string, string>) => {
  return (
    recordToInsert.type &&
    recordToInsert.address &&
    recordToInsert.postCode &&
    recordToInsert.town &&
    recordToInsert.population &&
    recordToInsert.size &&
    recordToInsert.businessEmail
  );
};

const getSitesRecords = (Worksheet: Worksheet) => {
  const rows = [];

  const rowCount = Worksheet.actualRowCount;

  const nameCol = Worksheet.columns[0];
  const typeCol = Worksheet.columns[1];
  const addressCol = Worksheet.columns[2];
  const postCodeCol = Worksheet.columns[3];
  const townCol = Worksheet.columns[4];
  const populationCol = Worksheet.columns[5];
  const sizeCol = Worksheet.columns[6];
  const businessEmailCol = Worksheet.columns[7];
  const workinghours = Worksheet.columns[8];

  for (let a = 2; a <= rowCount; a++) {
    const row: any = {
      [`${nameCol?.values?.[1]}`]: nameCol.values?.[a],
      [`${typeCol?.values?.[1]}`]: typeCol.values?.[a],
      [`${addressCol?.values?.[1]}`]: addressCol.values?.[a],
      [`${postCodeCol?.values?.[1]}`]: postCodeCol.values?.[a],
      [`${townCol?.values?.[1]}`]: townCol.values?.[a],
      [`${populationCol?.values?.[1]}`]: populationCol.values?.[a],
      [`${sizeCol?.values?.[1]}`]: sizeCol.values?.[a],
      [`${businessEmailCol?.values?.[1]}`]: businessEmailCol.values?.[a],
      [`${workinghours?.values?.[1]}`]: workinghours.values?.[a],
    };
    rows.push(row);
  }
  return rows.filter(isValidSiteRow);
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

  const [countries, states] = await Promise.all([SitesService.getCountries(), SitesService.getStates()]);

  const validColums = [
    { name: 'businessName', validate: { required: true } },
    { name: 'businessType', validate: { required: true } },
    { name: 'businessService', validate: { required: true } },
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
      name: 'countryId',
      parseValue: async (val: string) => {
        return countries.find((c) => c.name === val)?.id;
      },
      validate: { required: true },
    },
    {
      name: 'stateId',
      parseValue: async (val: string) => {
        return states.find((c) => c.name === val)?.id;
      },
      validate: { required: true },
    },
    { name: 'currencyCode', validate: { required: true } },
    {
      name: 'password',
      validate: { required: true },
      parseValue: (val: string) => {
        return encryptPassword(val);
      },
    },
    { name: 'address_1', validate: { required: false } },
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
              .parseValue(colVal)
              .then((val: string) => {
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
