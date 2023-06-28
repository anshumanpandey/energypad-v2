import Decimal from 'decimal.js';
import { ApiError } from '@lib';
import { SitesService } from '@services';
import { Workbook } from 'exceljs';
import { AppModels } from '../../types/types';
import { resolveConsumptionToKwh, SupportedUnits } from '../../utils/unitsUtils';
import DB from '../db/Db';
import { Knex } from 'knex';

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

export const extractConsumptionData = async (
  file: string | Buffer,
  opt: { sites: AppModels['Site'][]; fuels: AppModels['FuelSource'][]; uses: AppModels['FuelUse'][] },
) => {
  const workbook = await readExcelFile(file);

  const consumptions: any[] = [];
  const sheet = workbook.worksheets[0];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      return new ApiError(`Site [${siteCode}] not found`);
    }
    const fuel = currentRow.getCell('E').text;
    const year = currentRow.getCell('B').text;
    const month = MonthMap[currentRow.getCell('C').text];

    const date = `${year}-${month.length === 1 ? `0${month}` : month}-01`;

    const conversionFactor = new Decimal(currentRow.getCell('I').text).toNumber();
    const consumption = new Decimal(currentRow.getCell('F').text).toDP(2).toNumber();
    const totalCost = new Decimal(currentRow.getCell('H').text).toDP(2).toNumber();

    const fuelUnit = currentRow.getCell('G').text as typeof SupportedUnits[0];
    const record = {
      date,
      vat: new Decimal(totalCost).dividedBy(100).times(site.vat).toDP(2).toNumber(),
      totalCost: totalCost,
      fuelUnit,
      siteId: site?.id,
      fuelSourceId: opt.fuels.find((f) => f.source.toLowerCase() === fuel.toLowerCase())?.id,
      consumption: resolveConsumptionToKwh({ consumption, conversionFactor, fuelUnit }),
      conversionFactor: conversionFactor,
      usedInId: [opt.uses.find((u) => currentRow.getCell('D').text === u.use)?.id],
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
  const sheet = workbook.worksheets[1];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      return new ApiError(`Site [${siteCode}] not found`);
    }
    const fuel = currentRow.getCell('D').text;
    const year = currentRow.getCell('B').text;
    const emissionFactor = new Decimal(currentRow.getCell('F').text).toDP(2).toNumber();
    const fuelUnit = currentRow.getCell('E').text as typeof SupportedUnits[0];
    const month = MonthMap[currentRow.getCell('C').text];
    const fuelSourceId = opt.fuels.find((f) => f.source === fuel)?.id;

    const date = `${year}-${month.length === 1 ? `0${month}` : month}-01`;

    const consumptionForThis = opt.consumptions.find(
      (c) => c.siteId === site.id && c.date === date && c.fuelSourceId === fuelSourceId,
    );

    const record = {
      date,
      siteId: site.id,
      emissionFactor: emissionFactor,
      fuelUnit,
      fuelSourceId: fuelSourceId,
      conversionFactor: DB.raw('DEFAULT') as Knex.Raw | number,
      usedInId: [],
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
  const sheet = workbook.worksheets[2];

  for (let r = 2; r <= sheet.actualRowCount; r++) {
    const currentRow = sheet.getRow(r);

    const siteCode = currentRow.getCell('A').text;
    const site = opt.sites.find((s) => s.code?.toString() === siteCode);
    if (!site) {
      return new ApiError(`Site [${siteCode}] not found`);
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
