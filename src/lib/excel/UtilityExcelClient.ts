import { ApiError } from '@lib';
import { parse } from 'date-fns';
import { ConversionUnitService, SitesService, UtilityService } from '@services';
import { Workbook, Worksheet } from 'exceljs';
import { capitalizeFirstLetter } from '../../utils/appUtils';
import { DbUtils } from '@utils';

export const getUtilityData = async (file: string | Buffer) => {
  const workbook = await readExcelFile(file);
  let error = null;

  const rawConsumptions = getConsumptions(workbook.worksheets[0]);
  const rawEmissions = getEmissions(workbook.worksheets[1]);
  const rawTarget = getTargedData(workbook.worksheets[2]);
  const patterns = getSetpointsData(workbook.worksheets[3])
  const drivers = getDriversData(workbook.worksheets[4]);

  const sitesNames = Array.from(
    new Set(
      rawConsumptions
        .map((i: any) => i.siteName)
        .concat(rawEmissions.map((i: any) => i.siteName))
        .concat(rawTarget.map((i: any) => i.siteName)),
    ).values(),
  ).map((s) => s.trim());

  const fuelUsesName = Array.from(
    new Set(
      rawConsumptions
        .map((i: any) => i.fuelUses)
        .concat(rawEmissions.map((i: any) => i.fuelUses))
        .concat(patterns.map((i: any) => i.fuelUses))
        .flat(),
    ),
  );
  const fuelSourceNames = Array.from(
    new Set(
      rawConsumptions
        .map((i: any) => i.fuelType)
        .concat(rawEmissions.map((i: any) => i.fuelType))
        .concat(rawTarget.map((i: any) => i.fuelType)),
    ).values(),
  );
  const conversionUnitsNames = Array.from(
    new Set(
      rawConsumptions
        .map((i: any) => i.fuelUnit)
        .concat(rawEmissions.map((i: any) => i.fuelUnit))
        .concat(rawTarget.map((i: any) => i.fuelUnit)),
    ).values(),
  );

  const [sites, fuelUses, fuelTypes, conversionUnits] = await Promise.all([
    SitesService.findBy({ name: sitesNames }),
    UtilityService.findFuelUseBy({ names: fuelUsesName }),
    UtilityService.findFuelBy({ names: fuelSourceNames }),
    ConversionUnitService.findBy({ names: Array.from(new Set(conversionUnitsNames).values()) }),
  ]);

  const consumptions = [];
  for (let i = 0; i < rawConsumptions.length; i++) {
    const consumption = rawConsumptions[i];

    const site = sites.find((s) => s.name.trim() === consumption.siteName.trim());
    if (site === undefined) {
      error = new ApiError(`Site not found ${consumption.siteName}`);
    }
    const foundFuelUses = fuelUses.filter((fu) => consumption.fuelUses.includes(fu.use));
    const fuelSource = fuelTypes.find((ft) => ft.source === consumption.fuelType);
    if (fuelSource === undefined) {
      error = new ApiError(`Fuel type not found ${consumption.fuelType}`);
    }
    const fuelUnit = conversionUnits.find((s) => s.toLowerCase() === consumption.fuelUnit.toLowerCase());
    if (fuelUnit === undefined) {
      error = new ApiError(`Invalid fuel unit ${consumption.fuelUnit}`);
    }
    consumptions.push({
      //TODO: add support for short and long month name. eg: January and Jan
      date: DbUtils.dateToStringDate(parse(`01/${consumption.month}/${consumption.year}`, 'dd/MMM/yyyy', new Date())),
      conversionFactor: consumption.conversionFactor,
      consumption: consumption.consumptionValue,
      vat: consumption.vat,
      totalCost: consumption.totalCost,
      siteId: site?.id,
      fuelSourceId: fuelSource?.id,
      fuelUnit: fuelUnit,
      population: consumption.population,
      //TODO: hardcoded for now while figure out where to take it from
      usedInId: foundFuelUses[0].id,
    });
  }

  const emissions = [];
  for (let i = 0; i < rawEmissions.length; i++) {
    const consumption = rawEmissions[i];

    const site = sites.find((s) => s.name.trim() === consumption.siteName.toString().trim());
    if (site === undefined) {
      error = new ApiError(`Site not found ${consumption.siteName}`);
    }
    const foundFuelUses = fuelUses.filter((fu) => consumption.fuelUses.includes(fu.use));
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
      emissionFactor: consumption.emissionFactor,
      siteId: site?.id,
      fuelSourceId: fuelSource?.id,
      fuelUnit: fuelUnit,
      fuelUses: foundFuelUses.map((i) => i.id),
    });
  }

  const targetConsumption = [];
  for (let i = 0; i < rawTarget.length; i++) {
    const target = rawTarget[i];

    const site = sites.find((s) => s.name === target.siteName);
    const fuelSource = fuelTypes.find((ft) => ft.source === target.fuelType);
    const fuelUnit = conversionUnits.find((s: any) => s === target.fuelUnit);

    targetConsumption.push({
      date: DbUtils.dateToStringDate(parse(`01/${target.month}/${target.year}`, 'dd/MMM/yyyy', new Date())),
      siteId: site?.id,
      fuelSourceId: fuelSource?.id,
      fuelUnit: fuelUnit,
      targetValue: target.value,
      targetCarbon: target.targetCarbon,
    });
  }

  const driversData = [];
  for (let i = 0; i < drivers.length; i++) {
    const driver = drivers[i];
    const site = sites.find((s) => s.name.trim() === driver.siteName.toString().trim());
    if (site === undefined) {
      error = new ApiError(`Site not found ${driver.siteName}`);
    }

    driversData.push({
      heating: driver.heating,
      cooling: driver.cooling,
      population: driver.population,
      operatingHours: driver.operatingHours,
      daylight: driver.daylight,
      buildingSize: driver.buildingSize,

      siteId: site?.id,
    });
  }

  const patternsData = [];
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const site = sites.find((s) => s.name.trim() === pattern.siteName.toString().trim());
    if (site === undefined) {
      error = new ApiError(`Site not found ${pattern.siteName}`);
    }

    const foundFuelUses = fuelUses.filter((fu) => pattern.fuelUses.includes(fu.use));

    patternsData.push({
      startDate: pattern.startDate,
      endDate: pattern.endDate,
      daysOnYear: pattern.daysOnYear || 0,
      temperature: pattern.temperature ? Number.parseInt(pattern.temperature.toString()): null,
      usedInId: foundFuelUses.find(u => u.id)?.id || null,      

      siteId: site?.id,
    });
  }

  const result = {
    consumptions,
    emissions,
    targetConsumption,
    driversData,
    patternsData
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
    fuelUses: 'D',
    fuelType: 'E',
    conversionFactor: 'K',
    vat: 'J',
    consumptionValue: 'G',
    fuelUnit: 'H',
    totalCost: 'I',
    population: 'L',
    fullTimeEmployeeHours: 'M',
  };
  const records: Record<string, any>[] = [];
  for (let i = 2; i <= w.actualRowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString().trim(),
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
        .split(', ')
        .flat()
        .map((i) => capitalizeFirstLetter(i.trim())),
      population: row.getCell(columnMap.population).toString(),
      fullTimeEmployeeHours: row.getCell(columnMap.fullTimeEmployeeHours).toString(),
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
    fuelUses: 'G',
    emissionFactor: 'F',
  };
  const records: Record<string, string | string[]>[] = [];
  for (let i = 2; i <= w.actualRowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString().trim(),
      year: row.getCell(columnMap.year).toString(),
      month: row.getCell(columnMap.month).toString(),
      fuelType: row.getCell(columnMap.fuelType).toString(),
      fuelUnit: row.getCell(columnMap.fuelUnit).toString().split('-').pop() || '',
      //conversionFactor: row.getCell(columnMap.conversionFactor).toString(),
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
    targetCarbon: 'G',
  };
  const records: Record<string, string | string[]>[] = [];
  for (let i = 2; i <= w.actualRowCount; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString().trim(),
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

const getDriversData = (w: Worksheet) => {
  const columnMap = {
    siteName: 'A',
    year: 'B',
    heating: 'C',
    cooling: 'D',
    population: 'E',
    operatingHours: 'F',
    daylight: 'G',
    buildingSize: 'H',
  };
  const records: Record<string, string | string[]>[] = [];
  const max = w.actualRowCount + 1;
  for (let i = 7; i <= max; i++) {
    const row = w.getRow(i);

    const r = {
      siteName: row.getCell(columnMap.siteName).toString().trim(),
      year: row.getCell(columnMap.year).toString(),
      heating: row.getCell(columnMap.heating).toString(),
      cooling: row.getCell(columnMap.cooling).toString(),
      population: row.getCell(columnMap.population).toString().split('-').pop() || '',
      operatingHours: row.getCell(columnMap.operatingHours).toString() || '',
      daylight: row.getCell(columnMap.daylight).toString() || '',
      buildingSize: row.getCell(columnMap.buildingSize).toString() || '',
    };
    records.push(r);
  }
  return records;
};

const getSetpointsData = (w: Worksheet) => {
  const columnMap = {
    siteName: 'A',
    fuelUses: 'B',
    fuel: 'C',
    startDate: 'D',
    endDate: 'E',
    temperature: 'F',
    daysOnYear: 'G',
  };
  const records: Record<string, string | string[]>[] = [];
  const max = w.actualRowCount;
  for (let i = 7; i <= max; i++) {
    const row = w.getRow(i);

    //@ts-expect-error row can be undefined or date `2020-01-01`
    const startDate = row.getCell(columnMap.startDate).value.result;
    //@ts-expect-error row can be undefined or date `2020-01-01`
    const endDate = row.getCell(columnMap.endDate).value.result;

    const r = {
      siteName: row.getCell(columnMap.siteName).toString().trim(),
      fuelUses: row.getCell(columnMap.fuelUses).toString() || '',
      fuel: row.getCell(columnMap.fuel).toString() || '',
      startDate: startDate?.toISOString().split("T")[0] || '',
      endDate: endDate?.toISOString()?.split("T")[0] || '',
      temperature: row.getCell(columnMap.temperature).toString() || '',
      daysOnYear: row.getCell(columnMap.daysOnYear).toString() || '',
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
