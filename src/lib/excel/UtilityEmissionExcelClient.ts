import Decimal from 'decimal.js';
import { ApiError } from '@lib';
import { SitesService } from '@services';
import { Workbook } from 'exceljs';
import { AppModels } from '../../types/types';
import { resolveConsumptionToKwh, SupportedUnits } from '../../utils/unitsUtils';
import DB from '../db/Db';
import { Knex } from 'knex';
import { MathUtils } from '@utils';

const MonthMap: { names: string[]; value: string }[] = [
  { names: ['jan', 'january'], value: '01' },
  { names: ['feb', 'february'], value: '02' },
  { names: ['mar', 'march'], value: '03' },
  { names: ['apr', 'april'], value: '04' },
  { names: ['may', 'may'], value: '05' },
  { names: ['jun', 'june'], value: '06' },
  { names: ['jul', 'july'], value: '07' },
  { names: ['aug', 'august'], value: '08' },
  { names: ['sep', 'september'], value: '09' },
  { names: ['oct', 'october'], value: '10' },
  { names: ['nov', 'november'], value: '11' },
  { names: ['dec', 'december'], value: '12' },
];

const getMonthByName = (name: string) => {
  return MonthMap.find((m) => m.names.includes(name.toLowerCase()))?.value;
};

export const extractConsumptionData = async (
  file: string | Buffer,
  opt: { sites: AppModels['Site'][]; fuels: AppModels['FuelSource'][]; uses: AppModels['FuelUse'][] },
) => {
  const workbook = await readExcelFile(file);

  const consumptions: any[] = [];
  const [sheet] = workbook.worksheets.filter((w) => w.name.toLowerCase() === 'consumption');

  const errors: ApiError[] = [];
  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      const e = new ApiError(`Consumption sheet: Site [${siteCode}] not found. Line ${currentRow.number}`);
      errors.push(e);
    }
    const month = getMonthByName(currentRow.getCell('C').text);
    if (!month) {
      const e = new ApiError(`Month [${currentRow.getCell('C').text}] not found. Line ${currentRow.number}`);
      errors.push(e);
    }
  }

  if (errors.length !== 0) {
    return new ApiError('Err error', 400, { from: errors });
  }

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode) || { vat: 0, id: 0 }; //NOTE: we add optionals values so compiler dont show error
    const fuel = currentRow.getCell('E').text;
    const year = currentRow.getCell('B').text;
    const month = getMonthByName(currentRow.getCell('C').text);

    const date = `${year}-${month}-01`;

    const conversionFactor = new Decimal(currentRow.getCell('J').text).toNumber();
    const consumption = new Decimal(currentRow.getCell('F').text).toDP(2).toNumber();
    const totalCost = new Decimal(currentRow.getCell('H').text).toDP(2).toNumber();
    const vatCost = new Decimal(currentRow.getCell('I').text).toDP(2).toNumber();
    const population = new Decimal(currentRow.getCell('K').text || 0).toDP(2).toNumber();
    const workingHours = new Decimal(currentRow.getCell('L').text || 0).toDP(2).toNumber();

    const fuelUnit = currentRow.getCell('G').text as typeof SupportedUnits[0];
    const record = {
      rowIdx: currentRow.number,
      date,
      vat: new Decimal(totalCost).dividedBy(100).times(site.vat).toDP(2).toNumber(),
      totalCost: totalCost,
      fuelUnit,
      siteId: site?.id,
      fuelSourceId: opt.fuels.find((f) => f.source.toLowerCase() === fuel.toLowerCase())?.id,
      consumption: resolveConsumptionToKwh({ consumption, conversionFactor, fuelUnit }),
      conversionFactor: conversionFactor,
      usedInId: opt.uses.find((u) => currentRow.getCell('D').text === u.use)?.id,
      vatCost,
      population,
      workingHours
    };
    consumptions.push(record);
  }

  return consumptions;
};

export const extractEmissionsData = async (
  file: string | Buffer,
  opt: {
    sites: Awaited<ReturnType<typeof SitesService.findBy>>;
    fuels: AppModels['FuelSource'][];
    consumptions: AppModels['UtilityConsumption'][];
  },
) => {
  const workbook = await readExcelFile(file);

  const consumptions: any[] = [];
  const [sheet] = workbook.worksheets.filter((w) => w.name.toLowerCase() === 'emissions');

  const errors: ApiError[] = [];
  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      const e = new ApiError(`Emission sheet: Site [${siteCode}] not found. Line: ${currentRow.number}`);
      errors.push(e);
    }
    const month = getMonthByName(currentRow.getCell('C').text);
    if (!month) {
      const e = new ApiError(`Month [${currentRow.getCell('C').text}] not found. Line: ${currentRow.number}`);
      errors.push(e);
    }
  }

  if (errors.length !== 0) {
    return new ApiError('Err error', 400, { from: errors });
  }

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode) || { id: 0 }; //NOTE: we add optionals values so compiler dont show error

    const fuel = currentRow.getCell('D').text;
    const year = currentRow.getCell('B').text;
    const emissionFactor = new Decimal(currentRow.getCell('F').text).toDP(2).toNumber();
    const fuelUnit = currentRow.getCell('E').text as typeof SupportedUnits[0];
    const month = getMonthByName(currentRow.getCell('C').text);

    const fuelSourceId = opt.fuels.find((f) => f.source === fuel)?.id;
    const date = `${year}-${month}-01`;

    const consumptionForThis = opt.consumptions.find(
      (c) => c.siteId === site.id && c.date === date && c.fuelSourceId === fuelSourceId,
    );

    const record = {
      rowIdx: currentRow.number,
      date,
      siteId: site.id,
      emissionFactor: emissionFactor,
      fuelUnit,
      fuelSourceId: fuelSourceId,
      conversionFactor: DB.raw('DEFAULT') as Knex.Raw | number,
    };
    if (consumptionForThis) {
      const factor = new Decimal(emissionFactor).times(consumptionForThis.consumption).toDP(2).toNumber();
      record.conversionFactor = factor;
    }
    consumptions.push(record);
  }

  return consumptions;
};
export const extractTargetData = async (
  file: string | Buffer,
  opt: { sites: Awaited<ReturnType<typeof SitesService.findBy>>; fuels: AppModels['FuelSource'][] },
) => {
  const workbook = await readExcelFile(file);

  const monitoring: any[] = [];
  const [sheet] = workbook.worksheets.filter((w) => w.name.toLowerCase() === 'targets');

  const errors: ApiError[] = [];
  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      const e = new ApiError(`Targets sheet: Site [${siteCode}] not found. Line ${currentRow.number}`);
      errors.push(e);
    }
    const month = getMonthByName(currentRow.getCell('C').text);
    if (!month) {
      const e = new ApiError(`Month [${currentRow.getCell('C').text}] not found. Line ${currentRow.number}`);
      errors.push(e);
    }
  }

  if (errors.length !== 0) {
    return new ApiError('Err error', 400, { from: errors });
  }

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);
    const fuel = currentRow.getCell('D').text;
    const year = currentRow.getCell('B').text;

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode) || { id: 0 };

    const fuelUnit = currentRow.getCell('E').text as typeof SupportedUnits[0];
    const energy = MathUtils.toInt(currentRow.getCell('F').text);
    const carbon = currentRow.getCell('G').text;
    const month = getMonthByName(currentRow.getCell('C').text);

    const date = `${year}-${month}-01`;

    const record = {
      rowIdx: currentRow.number,
      date,
      siteId: site.id,
      energy,
      carbon,
      fuelUnit,
      conversionFactor: energy,
      fuelSourceId: opt.fuels.find((f) => f.source === fuel)?.id,
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
