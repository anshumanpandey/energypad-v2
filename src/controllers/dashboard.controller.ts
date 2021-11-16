import Decimal from 'decimal.js';
import { UtilityService } from '@services';
import { AuthGetAppController } from '@types';

export const getDataByYear: AuthGetAppController<'GetDashboardData', '/api/dashboard/'> = async (req) => {
  const userUtilities = await UtilityService.findBy({ businessId: req.user.id });
  const consumptions = await UtilityService.getConsumptionPerUtility({ utilityId: userUtilities.map((i) => i.id) });

  const filterByMonth = (idx: number) => (c: typeof consumptions[0]) => {
    const [, month] = c.date.split('-');
    return new Decimal(month).equals(idx);
  };

  const getAvarage = (records: typeof consumptions) => {
    const amountOfRecords = records.length;
    const sumOfAll = records.reduce((prev, next) => new Decimal(next.consumption).plus(prev).toNumber(), 0);
    return new Decimal(sumOfAll).dividedBy(amountOfRecords).toNumber();
  };

  const avaragePerMonth = [];
  for (let idx = 1; idx <= 12; idx++) {
    const consumptionFilter = filterByMonth(idx);
    const consumptionOfMonth = consumptions.filter(consumptionFilter);
    if (consumptionOfMonth.length !== 0) {
      avaragePerMonth.push({
        date: `${new Date().getFullYear()}-${('0' + idx).slice(-2)}-01`,
        avarage: getAvarage(consumptionOfMonth),
      });
    }
  }
  return avaragePerMonth;
};
