import Decimal from 'decimal.js';
import { UtilityService } from '@services';
import { AuthGetAppController } from '@types';

export const getDataByYear: AuthGetAppController<'GetDashboardData', '/api/dashboard/'> = async (req) => {
  const userUtilities = await UtilityService.findBy({ businessId: req.user.id });
  const consumptions = await UtilityService.getConsumptionPerUtility({ utilityId: userUtilities.map((i) => i.id) });

  const filterByMonth = (monthToSearch: number) => (c: typeof consumptions[0]) => {
    const [, month] = c.date.split('-');
    return new Decimal(month).equals(monthToSearch);
  };

  const getAverage = (records: typeof consumptions, of: 'consumption' | 'cost') => {
    const amountOfRecords = records.length;
    const sumOfAll = records.reduce((prev, next) => new Decimal(next[of]).plus(prev).toNumber(), 0);
    return new Decimal(sumOfAll).dividedBy(amountOfRecords).toNumber();
  };

  const sortByDate = (a: typeof consumptions[0], b: typeof consumptions[0]) => {
    const startDate = a.date.split('-');
    const endDate = b.date.split('-');
    return (
      new Date(
        new Decimal(startDate[0]).toNumber(),
        new Decimal(startDate[1]).minus(1).toNumber(),
        new Decimal(startDate[2]).toNumber(),
      ).valueOf() -
      new Date(
        new Decimal(endDate[0]).toNumber(),
        new Decimal(endDate[1]).minus(1).toNumber(),
        new Decimal(endDate[2]).toNumber(),
      ).valueOf()
    );
  };

  const avaragePerMonth = [];
  for (let idx = 0; idx < 12; idx++) {
    const consumptionFilter = filterByMonth(idx);
    const consumptionOfMonth = consumptions.filter(consumptionFilter).sort(sortByDate);
    if (consumptionOfMonth.length !== 0) {
      console.log({ consumptionOfMonth });
      const mostRecentRecord = consumptionOfMonth[consumptionOfMonth.length - 1];
      avaragePerMonth.push({
        date: `${new Date().getFullYear()}-${('0' + idx).slice(-2)}-01`,
        averageConsumption: getAverage(consumptionOfMonth, 'consumption'),
        averageCost: getAverage(consumptionOfMonth, 'cost'),
        consumption: mostRecentRecord ? mostRecentRecord.consumption : 0,
      });
    }
  }
  return avaragePerMonth;
};
