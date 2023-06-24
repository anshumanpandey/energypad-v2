import { ApiError } from '@lib';
import { SitesService, UtilityService } from '@services';
import { Workbook } from 'exceljs';
import { resolveUnitConversion, SupportedUnits } from '../../utils/unitsUtils';

const MonthMap: Record<string, string> = {
  Jan: '1',
  Feb: '2',
  Mar: '3',
  Apr: '4',
  May: '5',
  Jun: '6',
  Jul: '7',
  Aug: '8',
  Sep: '9',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

export const extractConsumptionData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const [sites, uses, fuels] = await Promise.all([
    SitesService.findBy(),
    UtilityService.findFuelUseBy(),
    UtilityService.findFuelBy(),
  ]);

  const consumptions: any[] = [];
  const sheet = workbook.worksheets[0];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteId = currentRow.getCell('A').text;
    const site = sites.find((s) => s.id.toString() === siteId);
    if (!site) {
      return new ApiError(`Site [${siteId}] not found`);
    }
    const fuel = currentRow.getCell('E').text;
    const year = currentRow.getCell('B').text;
    const month = MonthMap[currentRow.getCell('C').text];

    const date = `${year}-${month.length === 1 ? `0${month}` : month}-01`;

    const record = {
      date,
      vat: 0, //TODO: add VAT to the file
      totalCost: Number.parseInt(currentRow.getCell('H').text),
      fuelUnit: currentRow.getCell('G').text,
      siteId: site?.id,
      fuelSourceId: fuels.find((f) => f.source.toLowerCase() === fuel.toLowerCase())?.id,
      consumption: currentRow.getCell('F').text,
      conversionFactor: currentRow.getCell('I').text,
      usedInId: [uses.find((u) => currentRow.getCell('D').text === u.use)?.id],
    };
    consumptions.push(record);
  }

  return consumptions;
};

export const extractEmissionsData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const [sites, fuels] = await Promise.all([SitesService.findBy(), UtilityService.findFuelBy()]);

  const consumptions: any[] = [];
  const sheet = workbook.worksheets[1];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteId = currentRow.getCell('A').text;
    const site = sites.find((s) => s.id.toString() === siteId);
    if (!site) {
      return new ApiError(`Site [${siteId}] not found`);
    }
    const fuel = currentRow.getCell('D').text;
    const year = currentRow.getCell('B').text;
    const emissionFactor = Number.parseFloat(currentRow.getCell('F').text);
    const fuelUnit = currentRow.getCell('E').text as typeof SupportedUnits[0];
    const month = MonthMap[currentRow.getCell('C').text];

    const date = `${year}-${month.length === 1 ? `0${month}` : month}-01`;

    const record = {
      date,
      siteId: site.id,
      emissionFactor,
      conversionFactor: resolveUnitConversion(emissionFactor, fuelUnit),
      fuelUnit,
      fuelSourceId: fuels.find((f) => f.source === fuel)?.id,
      usedInId: [],
    };
    consumptions.push(record);
  }

  return consumptions;
};
export const extractTargetData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const [sites, fuels] = await Promise.all([SitesService.findBy(), UtilityService.findFuelBy()]);

  const monitoring: any[] = [];
  const sheet = workbook.worksheets[2];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteId = currentRow.getCell('A').text;
    const site = sites.find((s) => s.id.toString() === siteId);
    if (!site) {
      return new ApiError(`Site [${siteId}] not found`);
    }
    const fuel = currentRow.getCell('D').text;
    const year = currentRow.getCell('B').text;
    const month = MonthMap[currentRow.getCell('C').text];
    const fuelUnit = currentRow.getCell('E').text as typeof SupportedUnits[0];
    const energy = Number.parseFloat(currentRow.getCell('F').text);
    const carbon = currentRow.getCell('G').text;

    const date = `${year}-${month.length === 1 ? `0${month}` : month}-01`;

    const record = {
      date,
      siteId: site.id,
      energy,
      carbon,
      fuelUnit,
      conversionFactor: resolveUnitConversion(energy, fuelUnit),
      fuelSourceId: fuels.find((f) => f.source === fuel)?.id,
      usedInId: [],
    };
    monitoring.push(record);
  }

  return monitoring;
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
