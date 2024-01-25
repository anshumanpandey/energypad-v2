import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeConsumption, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 723, email: 'mail723@mail.com' })]);

  await knex('Sites').insert([
    buildFakeSite({ id: 609, businessId: 723, name: 'Main Building NN', code: '609_main_nn' }),
  ]);

  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 4500,
      date: '2001-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4502,
      date: '2001-02-01',
      consumption: 65,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4504,
      date: '2001-03-01',
      consumption: 79,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4506,
      date: '2001-04-01',
      consumption: 75,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4508,
      date: '2001-05-01',
      consumption: 87,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4510,
      date: '2001-06-01',
      consumption: 81,
      fuelSourceId: 1,
      siteId: 609,
    }),

    buildFakeConsumption({
      id: 4512,
      date: '2002-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4514,
      date: '2002-02-01',
      consumption: 40,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4516,
      date: '2002-03-01',
      consumption: 70,
      fuelSourceId: 1,
      siteId: 609,
    }),
  ]);

  await knex('BusinessPatterns').insert([
    {
      siteId: 609,
      usedInId: 2,
      startDate: '2002-01-01',
      endDate: '2002-12-31',
      temperature: 40,
      daysOnYear: 100,
    },
  ]);

  await knex('UtilityConsumptionsUse').insert([
    {
      consumptionId: 4512,
      usedInId: 2,
    },
    {
      consumptionId: 4514,
      usedInId: 2,
    },
    {
      consumptionId: 4516,
      usedInId: 2,
    },
    {
      consumptionId: 4500,
      usedInId: 2,
    },
    {
      consumptionId: 4502,
      usedInId: 2,
    },
    {
      consumptionId: 4504,
      usedInId: 2,
    },
    {
      consumptionId: 4506,
      usedInId: 2,
    },
    {
      consumptionId: 4508,
      usedInId: 2,
    },
    {
      consumptionId: 4510,
      usedInId: 2,
    },
  ]);
}
