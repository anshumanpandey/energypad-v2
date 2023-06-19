import { ApiError } from '@lib';
import { SitesService, UtilityService } from '@services';
import { Workbook } from 'exceljs';
import { formatISO } from 'date-fns';
import AppLogger from '../Logger';

export const importUtilityEmissions = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const [sites, fuels] = await Promise.all([SitesService.findBy(), UtilityService.findFuelBy()]);

  const consumptions: any[] = [];
  workbook.eachSheet((sheet) => {
    const year = sheet.getRow(1).getCell('B').text;
    const fuel = sheet.getRow(2).getCell('B').text;
    //TODO: save currency code on DB
    const currency = sheet.getRow(3).getCell('B').text;

    const sitesRows = sheet.getRows(5, sheet.actualRowCount - 4);
    if (!sitesRows) {
      return new ApiError('Could not parse the file');
    }
    const rowsWithValues = sitesRows?.length || 0;

    for (let r = 0; r < rowsWithValues; r++) {
      const currentRow = sitesRows?.[r];
      const siteName = currentRow.getCell('B').text;
      const site = sites.find((s) => s.name.toLowerCase() === siteName.toLowerCase());
      if (!site) {
        return new ApiError(`Site [${siteName}] not found`);
      }

      for (let c = 2; c < currentRow.cellCount; c += 2) {
        const month = (c / 2).toString();
        const date = `${Number.parseInt(year)}-${month.length === 1 ? `0${month}` : month}-01`;

        const record = {
          date,
          vat: currentRow.getCell(c + 1).text,
          totalCost: Number.parseInt(currentRow.getCell(c + 2).text),
          fuelUnit: '', //TODO: should this be null?
          siteId: site?.id,
          fuelSourceId: fuels.find((f) => f.source.toLowerCase() === fuel.toLowerCase())?.id,
          consumption: 0,
          conversionFactor: 0,
          usedInId: [] as number[],
        };
        consumptions.push(record);
      }
    }
  });

  return {
    consumptions,
  };
};

export const importConsumptions = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const [sites, uses, fuels] = await Promise.all([
    SitesService.findBy(),
    UtilityService.findFuelUseBy(),
    UtilityService.findFuelBy(),
  ]);

  const consumptions: any[] = [];
  for (let i = 0; i < workbook.worksheets.length; i++) {
    const sheet = workbook.worksheets[i];
    const year = sheet.getRow(1).getCell('B').text;
    const fuel = sheet.getRow(2).getCell('B').text;
    const usesSplitted = sheet.getRow(4).getCell('B').text.split(';');
    const fuelUnit = sheet.getRow(3).getCell('B').text;

    const sitesRows = sheet.getRows(6, sheet.actualRowCount - 5);
    if (!sitesRows) {
      return new ApiError('Could not parse the file');
    }
    const rowsWithValues = sitesRows?.length || 0;

    for (let r = 0; r < rowsWithValues; r++) {
      const currentRow = sitesRows?.[r];
      const siteName = currentRow.getCell('B').text;

      for (let c = 2; c < currentRow.cellCount; c++) {
        const month = c.toString();
        const date = `${Number.parseInt(year)}-${month.length === 1 ? `0${month}` : month}-01`;
        const site = sites.find((s) => s.name.toLowerCase() === siteName.toLowerCase());
        AppLogger.error({ site, siteName });
        if (!site) {
          return new ApiError(`Site [${siteName}] not found`);
        }

        const record = {
          date,
          vat: 0,
          totalCost: 0,
          fuelUnit: fuelUnit,
          siteId: site?.id,
          fuelSourceId: fuels.find((f) => f.source.toLowerCase() === fuel.toLowerCase())?.id,
          conversionFactor: 0,
          consumption: currentRow.getCell(c + 1).text,
          usedInId: uses
            .filter((u) => usesSplitted.find((us) => us.toLowerCase() === u.use.toLowerCase()))
            .map((u) => u.id),
        };
        consumptions.push(record);
      }
    }
  }

  return {
    consumptions,
  };
};

export const importEmissions = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const emissions: any[] = [];
  const sheet = workbook.getWorksheet(1);
  const fuelUnit = sheet.getRow(2).getCell('B').text;
  const fuelType = sheet.getRow(1).getCell('B').text;

  const [fuel] = await UtilityService.findFuelBy({ names: fuelType });
  if (!fuel) {
    return new ApiError('Fuel not found');
  }

  const sitesRows = sheet.getRows(4, sheet.actualRowCount - 3);
  if (!sitesRows) {
    return new ApiError('Could not parse the file');
  }

  const yearsRow = sheet.getRow(3);
  if (!yearsRow) {
    return new ApiError('Could not parse the file');
  }

  const rowsWithValues = sitesRows?.length || 0;

  for (let r = 0; r < rowsWithValues; r++) {
    const currentRow = sitesRows?.[r];
    for (let c = 2; c < currentRow.cellCount; c += 2) {
      const year = yearsRow.getCell(c).text.split(' ')[0];

      if (year) {
        const date = formatISO(new Date(Number.parseInt(year), r, 1)).split('T')[0];

        const emission = currentRow.getCell(c).text;
        const conversionFactor = currentRow.getCell(c + 1).text;

        const record = {
          date,
          emission,
          conversionFactor,
          fuelSourceId: fuel.id,
        };
        emissions.push(record);
      }
    }
  }

  return emissions;
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
