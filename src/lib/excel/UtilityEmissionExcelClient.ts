import { ApiError } from '@lib';
import { SitesService, UtilityService } from '@services';
import { Workbook, Worksheet } from 'exceljs';
import { capitalizeFirstLetter } from '../../utils/appUtils';
import { formatISO } from 'date-fns';

export const importUtilityEmissions = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);

  const metaData = workbook.worksheets[0];
  const consumptionsSheet = workbook.worksheets[1];
  const emissionSheet = workbook.worksheets[2];
  const monitoringSheet = workbook.worksheets[3];

  const date = metaData.getRow(5).getCell('D');
  const siteName = metaData.getRow(5).getCell('B');
  const usedIn = metaData.getRow(5).getCell('F');

  const [sites, fuelSources, uses] = await Promise.all([
    SitesService.findBy({ name: siteName.text }),
    UtilityService.getFuelSources(),
    UtilityService.findFuelUseBy({ names: usedIn.text.split(',') }),
  ]);

  if (sites[0] === undefined) {
    return new ApiError(`Site [${siteName.text}] not found`);
  }

  const consumptions = [];
  for (let i = 2; i <= consumptionsSheet.actualRowCount; i++) {
    const fuelSource = consumptionsSheet.getRow(i).getCell('A').text;
    const consumption = consumptionsSheet.getRow(i).getCell('B').text;
    const fuelUnit = consumptionsSheet.getRow(i).getCell('C').text;
    const vat = consumptionsSheet.getRow(i).getCell('D').text;
    const totalCost = consumptionsSheet.getRow(i).getCell('E').text;
    const conversionFactor = consumptionsSheet.getRow(i).getCell('F').text;

    const foundFuelSource = fuelSources.find((i) => i.source === fuelSource);
    if (!foundFuelSource) {
      return new ApiError('Fuel source [${fuelSource}] not found');
    }

    consumptions.push({
      date: formatISO(new Date(date.text)).split('T')[0],
      consumption: Number.parseInt(consumption),
      totalCost: Number.parseInt(totalCost),
      vat: Number.parseInt(vat),
      conversionFactor: Number.parseInt(conversionFactor),
      fuelUnit,
      siteId: sites[0].id,
      fuelSourceId: foundFuelSource.id,
      usedInId: uses.filter((i) => usedIn.text.split(',').includes(i.use)).map((i) => i.id),
    });
  }

  const emissions = [];
  for (let i = 2; i <= emissionSheet.actualRowCount; i++) {
    const fuelSource = emissionSheet.getRow(i).getCell('A').text;
    const fuelUnit = emissionSheet.getRow(i).getCell('B').text;
    const emissionFactor = emissionSheet.getRow(i).getCell('C').text;
    const conversionFactor = emissionSheet.getRow(i).getCell('D').text;

    const foundFuelSource = fuelSources.find((i) => i.source === fuelSource);
    if (!foundFuelSource) {
      return new ApiError('Fuel source [${fuelSource}] not found');
    }

    emissions.push({
      date: formatISO(new Date(date.text)).split('T')[0],
      conversionFactor: Number.parseInt(conversionFactor),
      emissionFactor: Number.parseInt(emissionFactor),
      fuelUnit,
      siteId: sites[0].id,
      fuelSourceId: foundFuelSource.id,
      usedInId: uses.filter((i) => usedIn.text.split(',').includes(i.use)).map((i) => i.id),
    });
  }

  const targeting = [];
  for (let i = 2; i <= monitoringSheet.actualRowCount; i++) {
    const fuelSource = monitoringSheet.getRow(i).getCell('A').text;
    const fuelUnit = monitoringSheet.getRow(i).getCell('B').text;
    const conversionUnit = monitoringSheet.getRow(i).getCell('C').text;
    const energy = monitoringSheet.getRow(i).getCell('D').text;
    const carbon = monitoringSheet.getRow(i).getCell('E').text;

    const foundFuelSource = fuelSources.find((i) => i.source === fuelSource);
    if (!foundFuelSource) {
      return new ApiError('Fuel source [${fuelSource}] not found');
    }

    targeting.push({
      date: formatISO(new Date(date.text)).split('T')[0],
      fuelUnit,
      conversionFactor: Number.parseInt(conversionUnit),
      energy: Number.parseInt(energy),
      carbon: Number.parseInt(carbon),
      siteId: sites[0].id,
      fuelSourceId: foundFuelSource.id,
      usedInId: uses.filter((i) => usedIn.text.split(',').includes(i.use)).map((i) => i.id),
    });
  }

  return {
    consumptions,
    emissions,
    targeting,
  };
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
  for (let i = 2; i <= w.actualRowCount; i++) {
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
    fuelUses: 'G',
    emissionFactor: 'H',
  };
  const records: Record<string, string | string[]>[] = [];
  for (let i = 2; i <= w.actualRowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString(),
      year: row.getCell(columnMap.year).toString(),
      month: row.getCell(columnMap.month).toString(),
      fuelType: row.getCell(columnMap.fuelType).toString(),
      fuelUnit: row.getCell(columnMap.fuelUnit).toString().split('-').pop() || '',
      conversionFactor: row.getCell(columnMap.conversionFactor).toString(),
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

const getTargedData = (w: Worksheet) => {
  const columnMap = {
    siteName: 'A',
    year: 'B',
    month: 'C',
    fuelType: 'D',
    fuelUnit: 'E',
    value: 'F',
  };
  const records: Record<string, string | string[]>[] = [];
  for (let i = 2; i <= w.actualRowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString(),
      year: row.getCell(columnMap.year).toString(),
      month: row.getCell(columnMap.month).toString(),
      fuelType: row.getCell(columnMap.fuelType).toString(),
      fuelUnit: row.getCell(columnMap.fuelUnit).toString().split('-').pop() || '',
      value: row.getCell(columnMap.value).toString() || '',
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
