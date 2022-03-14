import { AuthAppController, AuthGetAppController } from '@types';
import { UtilityService, SitesService, UserService } from '@services';
import { ApiError, ExcelClient } from '@lib';
import { AddConsumptionToUtilityParam } from '../services/utility.service';
import { DbUtils } from '@utils';

export const addConsumption: AuthAppController<'AddFuelSourceConsumption', 'AddFuelSourceConsumption'> = async (
  req,
) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);
  const [fuelFound, siteFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId }),
    SitesService.findBy({ id: req.body.siteId }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (siteFound.length === 0) {
    return new ApiError('Site not found');
  }

  const params = {
    ...req.body,
    fuelSourceId,
  };

  await UtilityService.deleteBy({
    fuelSourceId,
    siteId: params.siteId,
    month: DbUtils.stringDateToDate(params.date),
  });
  await UtilityService.addConsumptionToUtility(params);

  return { success: true };
};

export const addEmission: AuthAppController<'AddFuelSourceEmission', 'AddFuelSourceEmission'> = async (req) => {
  const fuelSourceId = parseInt(req.params.fuelSourceId, 10);

  const siteToFind = Array.from(new Set(req.body.map((i) => i.siteId)));
  const [fuelFound, sitesFound] = await Promise.all([
    UtilityService.findFuelBy({ fuelSourceId }),
    SitesService.findBy({ id: siteToFind }),
  ]);
  if (fuelFound.length === 0) {
    return new ApiError('Utility to add not found');
  }
  if (sitesFound.length !== siteToFind.length) {
    return new ApiError('Site not found');
  }

  const mapEmission = (r: typeof req.body[0]) => {
    return {
      ...r,
      fuelSourceId,
    };
  };

  await UtilityService.addUtilityEmissions(req.body.map(mapEmission));

  return { success: true };
};

export const importLog: AuthAppController<'UtilityFileImport', 'UtilityFileImport'> = async (req) => {
  const excelFile = req.file;
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getLogData(excelFile.buffer);

  if (data.length === 0) {
    return new ApiError('No data was imported');
  }

  await UserService.saveLog(data);

  return { success: true };
};

export const importFile: AuthAppController<'LogFileImport', 'LogFileImport'> = async (req) => {
  const excelFile = req.file;
  const id = (req.body as unknown as Record<string, string>).fuelSource;
  const fuelSourceId = parseInt(id, 10);
  if (!fuelSourceId) return new ApiError('Missing fuelSourceId');
  if (!excelFile) return new ApiError('Missing file');

  const data = await ExcelClient.getUtilityData(excelFile.buffer);

  if (data instanceof ApiError) return data;

  const dataToInsert: AddConsumptionToUtilityParam[] = [];
  for (let i = 0, len = data.length; i < len; i++) {
    const entry = data[i];

    for (let a = 0, len = entry.rows.length; a < len; a++) {
      const yearEntry = entry.rows[a];

      for (let m = 0, len = yearEntry.months.length; m < len; m++) {
        const currentMonth = yearEntry.months[m];
        dataToInsert.push({
          fuelSourceId: fuelSourceId,
          date: `${yearEntry.year}-${currentMonth.month}-01`,
          consumption: parseInt(currentMonth.consumption, 10),
          cost: currentMonth.cost,
          siteId: currentMonth.siteId,
        });
      }
    }
  }

  if (dataToInsert.length === 0) {
    return new ApiError('No data was imported');
  }

  await UtilityService.deleteBy({
    siteId: dataToInsert.map((i) => i.siteId),
    fuelSourceId: dataToInsert.map((i) => i.fuelSourceId),
    month: dataToInsert.map((i) => DbUtils.stringDateToDate(i.date)),
  });
  await UtilityService.addConsumptionToUtility(dataToInsert);

  return { success: true };
};

export const getSavingTips: AuthGetAppController<'GetSavingTips'> = async () => {
  const tips = await UtilityService.getSavingTips();
  return tips;
};

export const getFuelSources: AuthGetAppController<'GetFuelSources'> = async () => {
  const tips = await UtilityService.getFuelSources();
  return tips;
};

export const getUses: AuthGetAppController<'GetUsedIn'> = async () => {
  const tips = await UtilityService.findFuelUseBy();
  return tips;
};

export const getEmissions: AuthGetAppController<'GetConsumptions'> = async (req) => {
  const consumptions = await UtilityService.getConsumptions({ businessId: req.user.id });
  return consumptions;
};

/*export const getHeatingEnergy: AuthGetAppController<'GetHeatingEnergy'> = async (req) => {
  const business = await UserService.getUserBy({ id: req.user.id });

  const today = EnvFactory({ fallback: new Date(), test: new Date(2022, 1, 25) });
  const patterns = await UserService.getPatterns({
    businessId: req.user.id,
    startDate: today,
    endDate: subMonths(today, 12),
  });

  const mapRecords = (r: any) => ({ startDate: r.startDate, endDate: r.endDate });

  const energyParams = {
    postCode: business.postCode,
    dayRanges: patterns.map(mapRecords),
    patterns,
  };
  const statistics = await UtilityService.consumingStatistics(energyParams);

  const hdds = [
    { value: 8 },
    { value: 7 },
    { value: 8 },
    { value: 6 },
    { value: 9 },
    { value: 8 },
    { value: 9 },
    { value: 6 },
  ];

  const sumOfHdd = hdds.reduce((total, next) => new Decimal(total).plus(next.value).toNumber(), 0);
  const hddsSquared = hdds.map((i) => new Decimal(i.value).pow(2).toNumber());
  const sumOfhddsSquared = hddsSquared.reduce((total, next) => new Decimal(total).plus(next).toNumber(), 0);

  const cdds = [
    { value: 4 },
    { value: 5 },
    { value: 6 },
    { value: 6 },
    { value: 5 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
  ];

  const sumOfCdd = cdds.reduce((total, next) => new Decimal(total).plus(next.value).toNumber(), 0);
  const cddsSquared = cdds.map((i) => new Decimal(i.value).pow(2).toNumber());
  const sumOfCddsSquared = cddsSquared.reduce((total, next) => new Decimal(total).plus(next).toNumber(), 0);

  const energyConsumption = [
    { consumption: 45 },
    { consumption: 44 },
    { consumption: 50 },
    { consumption: 43 },
    { consumption: 45 },
    { consumption: 44 },
    { consumption: 40 },
    { consumption: 43 },
  ];

  const sumOfEnergyConsumption = energyConsumption.reduce(
    (total, next) => new Decimal(total).plus(next.consumption).toNumber(),
    0,
  );

  const hddTimesConsumption = hdds.map((i, idx) =>
    new Decimal(i.value).times(energyConsumption[idx] ? energyConsumption[idx].consumption : 0).toNumber(),
  );
  const sumOfHddTimesConsumption = hddTimesConsumption.reduce(
    (total, next) => new Decimal(total).plus(next).toNumber(),
    0,
  );

  const cddTimesConsumption = cdds.map((i, idx) =>
    new Decimal(i.value).times(energyConsumption[idx] ? energyConsumption[idx].consumption : 0).toNumber(),
  );
  const sumOfCddTimesConsumption = cddTimesConsumption.reduce(
    (total, next) => new Decimal(total).plus(next).toNumber(),
    0,
  );

  const hddTimesCdd = hdds.map((i, idx) => new Decimal(i.value).times(cdds[idx] ? cdds[idx].value : 0).toNumber());
  const sumOfHddTimesCdd = hddTimesCdd.reduce((total, next) => new Decimal(total).plus(next).toNumber(), 0);

  const NX = hdds.length;

  //X1/NX
  const sumOfHddByNx = new Decimal(sumOfHdd).dividedBy(NX).toNumber();

  //X2/NX
  const sumOfCddByNx = new Decimal(sumOfCdd).dividedBy(NX).toNumber();

  //X2/1 result
  const sumOfHddApprox = new Decimal(sumOfhddsSquared)
    .minus(new Decimal(sumOfHdd).times(sumOfHdd).dividedBy(NX))
    .toNumber();

  //X2/2
  const sumOfCddApprox = new Decimal(sumOfCddsSquared)
    .minus(new Decimal(sumOfCdd).times(sumOfCdd).dividedBy(NX))
    .toNumber();

  //X1Y result
  const hddWithEnergyConsumption = new Decimal(sumOfHddTimesConsumption)
    .minus(new Decimal(sumOfHdd).times(sumOfEnergyConsumption).dividedBy(NX))
    .toNumber();

  //X2Y
  const cddWithEnergyConsumption = new Decimal(sumOfCddTimesConsumption)
    .minus(new Decimal(sumOfCdd).times(sumOfEnergyConsumption).dividedBy(NX))
    .toNumber();

  //X1X2 result
  const hddwithCddApprox = new Decimal(sumOfHddTimesCdd)
    .minus(new Decimal(sumOfHdd).times(sumOfCdd).dividedBy(NX))
    .toNumber();

  const b1Top = new Decimal(new Decimal(sumOfCddApprox).times(hddWithEnergyConsumption))
    .minus(new Decimal(hddwithCddApprox).times(cddWithEnergyConsumption))
    .toNumber();

  const b1Below = new Decimal(new Decimal(sumOfHddApprox).times(sumOfCddApprox))
    .minus(new Decimal(hddwithCddApprox).times(hddwithCddApprox))
    .toNumber();

  //b1
  const slope1 = new Decimal(b1Top).dividedBy(b1Below).toNumber();

  const b2Top = new Decimal(new Decimal(sumOfHddApprox).times(cddWithEnergyConsumption))
    .minus(new Decimal(hddwithCddApprox).times(hddWithEnergyConsumption))
    .toNumber();
  const b2Below = new Decimal(new Decimal(sumOfHddApprox).times(sumOfCddApprox))
    .minus(new Decimal(hddwithCddApprox).times(hddwithCddApprox))
    .toNumber();

  //b2
  const slope2 = new Decimal(b2Top).dividedBy(b2Below).toNumber();

  const yAvarage = new Decimal(sumOfEnergyConsumption).dividedBy(NX).toNumber();

  //yIntercept
  const baseload = new Decimal(new Decimal(yAvarage).minus(new Decimal(slope1).times(sumOfHddByNx)))
    .minus(new Decimal(slope2).times(sumOfCddByNx))
    .toNumber();

  console.log({
    b1Top,
    b1Below,
    b1: slope1,
    b2Top,
    b2: slope2,
    yAvarage,
    baseload,
  });

  const currenData = { hdd: 10, cdd: 5, gas: 48 };

  const projectedEnergy1 = new Decimal(currenData.hdd).times(slope1).toDecimalPlaces(6).toNumber();
  const projectedEnergy2 = new Decimal(currenData.cdd).times(slope2).toDecimalPlaces(6).toNumber();
  const totalProjectedEnergy = new Decimal(projectedEnergy1).plus(projectedEnergy2).toDecimalPlaces(8).toNumber();
  console.log({
    projectedEnergy1,
    projectedEnergy2,
    totalProjectedEnergy,
    savingWaster: new Decimal(totalProjectedEnergy).minus(currenData.gas).toDecimalPlaces(4).toNumber(),
  });

  return [];
};*/
