import { ApiError } from '@lib';
import { SitesService } from '@services';
import { encryptPassword } from '@utils';
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
  const sites = await getSitesRecords(siteWorksheet);

  const rows = [];

  for (let i = 0; i < sites.length; i++) {
    const { ['Building Name']: buildingName, ['Site ID']: name, ['Site ID']: siteId, ...el } = sites[i];

    rows.push({
      name,
      ...el,
    });
  }
  return rows;
};

const isValidSiteRow = (recordToInsert: Record<string, string>) => {
  return (
    recordToInsert.type &&
    recordToInsert.address &&
    recordToInsert.postCode &&
    recordToInsert.town &&
    recordToInsert.population &&
    recordToInsert.size
  );
};

const getSitesRecords = async (Worksheet: Worksheet) => {
  const countries = await SitesService.getCountries();
  const rows = [];

  const rowCount = Worksheet.actualRowCount;

  const codeCol = Worksheet.getColumn('A');
  const nameCol = Worksheet.getColumn('B');
  const typeCol = Worksheet.getColumn('C');
  const addressCol = Worksheet.getColumn('D');
  const postCodeCol = Worksheet.getColumn('F');
  const townCol = Worksheet.getColumn('E');
  const populationCol = Worksheet.getColumn('I');
  const sizeCol = Worksheet.getColumn('H');
  const workinghours = Worksheet.getColumn('J');
  const countryName = Worksheet.getColumn('G');
  const vat = Worksheet.getColumn('K');

  for (let a = 2; a <= rowCount; a++) {
    const row: any = {
      ['name']: nameCol.values?.[a],
      [`code`]: codeCol.values?.[a],
      [`type`]: typeCol.values?.[a],
      [`address`]: addressCol.values?.[a],
      [`postCode`]: postCodeCol.values?.[a],
      [`town`]: townCol.values?.[a],
      [`population`]: populationCol.values?.[a],
      [`size`]: sizeCol.values?.[a],
      [`workinghours`]: workinghours.values?.[a],
      [`vat`]: vat.values?.[a],
      [`countryId`]: countries.find((c) => c.name === countryName.values?.[a])?.id,
    };
    rows.push(row);
  }
  return rows.filter(isValidSiteRow);
};

const getRows = async (Worksheet: Worksheet) => {
  const rows = [];

  const countries = await SitesService.getCountries();

  const validColums = [
    { colLetter: 'A', name: 'businessName', validate: { required: true } },
    { colLetter: 'B', name: 'businessType', validate: { required: true } },
    { colLetter: 'C', name: 'businessService', validate: { required: true } },
    { colLetter: 'D', name: 'buildingName', validate: { required: true } },
    { colLetter: 'E', name: 'contactName', validate: { required: true } },
    { colLetter: 'F', name: 'position', validate: { required: true } },
    { colLetter: 'G', name: 'phoneNumber', validate: { required: true } },
    {
      colLetter: 'H',
      name: 'email',
      validate: { required: true },
    },
    { colLetter: 'K', name: 'town', validate: { required: true } },
    { colLetter: 'L', name: 'postCode', validate: { required: true } },
    {
      colLetter: 'M',
      name: 'countryId',
      parseValue: async (val: string) => {
        return countries.find((c) => c.name === val)?.id;
      },
      validate: { required: true },
    },
    { colLetter: 'N', name: 'currencyCode', validate: { required: true } },
    {
      colLetter: 'I',
      name: 'password',
      validate: { required: true },
      parseValue: (val: string) => {
        return encryptPassword(val);
      },
    },
    { colLetter: 'J', name: 'address_1', validate: { required: false } },
  ];

  const rowAmount = Worksheet.actualRowCount;
  root_loop: for (let i = 2; i <= rowAmount; i++) {
    const singleRow: Record<string, string | undefined> = {};
    const promises = [];
    loop: for (let a = 0, len = validColums.length; a < len; a++) {
      const validCol = validColums[a];
      const col = Worksheet.getColumn(validCol.colLetter).values;
      if (!col) continue loop;

      const castedCol = col[i] as any;
      const colVal = castedCol?.text ? castedCol?.text : castedCol?.toString();

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
