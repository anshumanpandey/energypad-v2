import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeConsumption, buildFakeEmission, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 723, email: 'mail723@mail.com' })]);

  await knex('Sites').insert([
    buildFakeSite({ id: 609, businessId: 723, name: 'Main Building 609', code: '609_main_nn' }),
    buildFakeSite({ id: 611, businessId: 723, name: 'Main Building 611', code: '611_main_nn' }),
    buildFakeSite({ id: 613, businessId: 723, name: 'Main Building 613', code: '613_main_nn' }),
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

    buildFakeConsumption({
      id: 4600,
      date: '2007-06-01',
      consumption: 81,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4602,
      date: '2007-06-01',
      consumption: 34,
      fuelSourceId: 2,
      siteId: 609,
    }),

    buildFakeConsumption({
      id: 4604,
      date: '2008-06-01',
      consumption: 424,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4606,
      date: '2008-06-01',
      consumption: 176,
      fuelSourceId: 2,
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

  await knex('UtilityEmissions').insert([
    buildFakeEmission({
      id: 350,
      date: `2002-01-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 20,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 352,
      date: `2002-02-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 80,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 354,
      date: `2002-03-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 43,
      siteId: 609,
    }),

    buildFakeEmission({
      id: 356,
      date: `2008-06-01`,
      fuelSourceId: 1,
      usedInId: 2,
      emissionFactor: 22,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 358,
      date: `2008-06-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 126,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 360,
      date: `2008-04-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 4,
      siteId: 609,
    }),
  ]);

  //user2
  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 4520,
      date: '2005-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4522,
      date: '2005-02-01',
      consumption: 65,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4524,
      date: '2005-03-01',
      consumption: 79,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4526,
      date: '2005-04-01',
      consumption: 75,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4528,
      date: '2005-05-01',
      consumption: 87,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4530,
      date: '2005-06-01',
      consumption: 81,
      fuelSourceId: 1,
      siteId: 611,
    }),

    buildFakeConsumption({
      id: 4532,
      date: '2006-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4534,
      date: '2006-02-01',
      consumption: 40,
      fuelSourceId: 1,
      siteId: 611,
    }),
    buildFakeConsumption({
      id: 4536,
      date: '2006-03-01',
      consumption: 70,
      fuelSourceId: 1,
      siteId: 611,
    }),
  ]);

  await knex('BusinessPatterns').insert([
    {
      siteId: 611,
      usedInId: 2,
      startDate: '2005-01-01',
      endDate: '2005-12-31',
      temperature: 40,
      daysOnYear: 100,
    },
  ]);

  // user 3
  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 4540,
      date: '2009-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4542,
      date: '2009-02-01',
      consumption: 65,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4544,
      date: '2009-03-01',
      consumption: 79,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4546,
      date: '2009-04-01',
      consumption: 75,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4548,
      date: '2009-05-01',
      consumption: 87,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4550,
      date: '2009-06-01',
      consumption: 81,
      fuelSourceId: 1,
      siteId: 613,
    }),

    buildFakeConsumption({
      id: 4552,
      date: '2010-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4554,
      date: '2010-02-01',
      consumption: 40,
      fuelSourceId: 1,
      siteId: 613,
    }),
    buildFakeConsumption({
      id: 4556,
      date: '2010-03-01',
      consumption: 70,
      fuelSourceId: 1,
      siteId: 613,
    }),
  ]);

  await knex('BusinessPatterns').insert([
    {
      siteId: 613,
      usedInId: 2,
      startDate: '2010-01-01',
      endDate: '2010-12-31',
      temperature: 40,
      daysOnYear: 100,
    },
  ]);
}
