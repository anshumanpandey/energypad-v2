import { ApiError } from '@lib';
import parse from 'date-fns/parse';
import { ConversionUnitService, SitesService, UtilityService } from '@services';
import { Workbook, Worksheet } from 'exceljs';
import { capitalizeFirstLetter } from '../../utils/appUtils';
import { DbUtils } from '@utils';

export const getUtilityData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  let error = null;

  const rawConsumptions = getConsumptions(workbook.worksheets[0]);
  const rawEmissions = getEmissions(workbook.worksheets[1]);

  const sitesNames = rawConsumptions.map((i: any) => i.siteName).concat(rawEmissions.map((i: any) => i.siteName));
  const fuelUsesName = rawConsumptions
    .map((i: any) => i.fuelUses)
    .concat(rawEmissions.map((i: any) => i.fuelUses))
    .flat();
  const fuelSourceNames = rawConsumptions.map((i: any) => i.fuelType).concat(rawEmissions.map((i: any) => i.fuelType));
  const conversionUnitsNames = rawConsumptions
    .map((i: any) => i.fuelUnit)
    .concat(rawEmissions.map((i: any) => i.fuelUnit));

  const [sites, fuelUses, fuelTypes, conversionUnits] = await Promise.all([
    SitesService.findBy({ name: sitesNames }),
    UtilityService.findFuelUseBy({ names: fuelUsesName }),
    UtilityService.findFuelBy({ names: fuelSourceNames }),
    ConversionUnitService.findBy({ names: conversionUnitsNames }),
  ]);

  const consumptions = [];
  for (let i = 0; i < rawConsumptions.length; i++) {
    const consumption = rawConsumptions[i];

    const site = sites.find((s) => s.name === consumption.siteName);
    if (site === undefined) {
      error = new ApiError(`Site not found ${consumption.siteName}`);
    }
    const foundFuelUses = fuelUses.filter((fu) => consumption.fuelUses.includes(fu.use));
    if (foundFuelUses.length !== consumption.fuelUses.length) {
      error = new ApiError(
        `Invalid one fuel use: ${
          Array.isArray(consumption.fuelUses) ? consumption.fuelUses.join(', ') : consumption.fuelUses
        }`,
      );
    }
    const fuelSource = fuelTypes.find((ft) => ft.source === consumption.fuelType);
    if (fuelSource === undefined) {
      error = new ApiError(`Fuel type not found ${consumption.fuelType}`);
    }
    const fuelUnit = conversionUnits.find((s: any) => s === consumption.fuelUnit);
    if (fuelUnit === undefined) {
      error = new ApiError(`Invalid fuel unit ${consumption.fuelUnit}`);
    }
    consumptions.push({
      date: DbUtils.dateToStringDate(parse(`01/${consumption.month}/${consumption.year}`, 'dd/MMM/yyyy', new Date())),
      conversionFactor: consumption.conversionFactor,
      consumption: consumption.consumptionValue,
      vat: consumption.vat,
      totalCost: consumption.totalCost,
      siteId: site?.id,
      fuelSourceId: fuelSource?.id,
      fuelUnit: fuelUnit,
      fuelUses: foundFuelUses.map((i) => i.id),
      population: consumption.population,
      fullTimeEmployeeHours: consumption.fullTimeEmployeeHours,
      buidingExtension: consumption.buidingExtension,
      changeBuildingLocation: consumption.changeBuildingLocation,
    });
  }

  const emissions = [];
  for (let i = 0; i < rawEmissions.length; i++) {
    const consumption = rawEmissions[i];

    const site = sites.find((s) => s.name === consumption.siteName);
    if (site === undefined) {
      error = new ApiError(`Site not found ${consumption.siteName}`);
    }
    const foundFuelUses = fuelUses.filter((fu) => consumption.fuelUses.includes(fu.use));
    if (foundFuelUses.length !== consumption.fuelUses.length) {
      error = new ApiError(
        `Invalid one fuel use: ${
          Array.isArray(consumption.fuelUses) ? consumption.fuelUses.join(', ') : consumption.fuelUses
        }`,
      );
    }
    const fuelSource = fuelTypes.find((ft) => ft.source === consumption.fuelType);
    if (fuelSource === undefined) {
      error = new ApiError(`Fuel type not found ${consumption.fuelType}`);
    }
    const fuelUnit = conversionUnits.find((s: any) => s === consumption.fuelUnit);
    if (fuelUnit === undefined) {
      error = new ApiError(`Invalid fuel unit ${consumption.fuelUnit}`);
    }
    emissions.push({
      date: DbUtils.dateToStringDate(parse(`01/${consumption.month}/${consumption.year}`, 'dd/MMM/yyyy', new Date())),
      conversionFactor: consumption.conversionFactor,
      consumption: consumption.consumptionValue,
      emissionFactor: consumption.emissionFactor,
      siteId: site?.id,
      fuelSourceId: fuelSource?.id,
      fuelUnit: fuelUnit,
      fuelUses: foundFuelUses.map((i) => i.id),
    });
  }

  const result = {
    consumptions,
    emissions,
  };

  if (error !== null) {
    return error;
  }
  return result;
};

const getConsumptions = (w: Worksheet) => {
  const columnMap = {
    siteName: 'A',
    year: 'B',
    month: 'C',
    fuelType: 'D',
    fuelUnit: 'E',
    conversionFactor: 'F',
    consumptionValue: 'G',
    vat: 'H',
    totalCost: 'I',
    fuelUses: 'J',
    population: 'K',
    fullTimeEmployeeHours: 'L',
    buildingExtension: 'M',
    changeBuildingLocation: 'N',
  };
  const records: Record<string, any>[] = [];
  for (let i = 2; i <= w.rowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString(),
      year: row.getCell(columnMap.year).toString(),
      month: row.getCell(columnMap.month).toString(),
      fuelType: row.getCell(columnMap.fuelType).toString(),
      fuelUnit: row.getCell(columnMap.fuelUnit).toString().split('-').pop() || '',
      conversionFactor: row.getCell(columnMap.conversionFactor).toString(),
      consumptionValue: row.getCell(columnMap.consumptionValue).toString(),
      vat: row.getCell(columnMap.vat).toString(),
      totalCost: row.getCell(columnMap.totalCost).toString(),
      fuelUses: row
        .getCell(columnMap.fuelUses)
        .toString()
        .split(';')
        .flat()
        .map((i) => capitalizeFirstLetter(i.trim())),
      population: row.getCell(columnMap.population).toString(),
      fullTimeEmployeeHours: row.getCell(columnMap.fullTimeEmployeeHours).toString(),
      buidingExtension: row.getCell(columnMap.buildingExtension).toString() === 'Yes',
      changeBuildingLocation: row.getCell(columnMap.changeBuildingLocation).toString() === 'Yes',
    };
    records.push(r);
  }
  return records;
};

const getEmissions = (w: Worksheet) => {
  const columnMap = {
    siteName: 'A',
    year: 'B',
    month: 'C',
    fuelType: 'D',
    fuelUnit: 'E',
    conversionFactor: 'F',
    consumptionValue: 'G',
    fuelUses: 'H',
    emissionFactor: 'I',
  };
  const records: Record<string, string | string[]>[] = [];
  for (let i = 2; i <= w.rowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString(),
      year: row.getCell(columnMap.year).toString(),
      month: row.getCell(columnMap.month).toString(),
      fuelType: row.getCell(columnMap.fuelType).toString(),
      fuelUnit: row.getCell(columnMap.fuelUnit).toString().split('-').pop() || '',
      conversionFactor: row.getCell(columnMap.conversionFactor).toString(),
      consumptionValue: row.getCell(columnMap.consumptionValue).toString(),
      emissionFactor: row.getCell(columnMap.emissionFactor).toString(),
      fuelUses: row
        .getCell(columnMap.fuelUses)
        .toString()
        .split(';')
        .flat()
        .map((i) => capitalizeFirstLetter(i.trim())),
    };
    records.push(r);
  }
  return records;
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
