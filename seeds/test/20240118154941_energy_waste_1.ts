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
      id: 4700,
      date: '2001-01-01',
      consumption: 1940.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4702,
      date: '2001-02-01',
      consumption: 2150.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4704,
      date: '2001-03-01',
      consumption: 1340.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4706,
      date: '2001-04-01',
      consumption: 1700.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4708,
      date: '2001-05-01',
      consumption: 1800.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4710,
      date: '2001-06-01',
      consumption: 1700.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4712,
      date: '2001-07-01',
      consumption: 1982.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4714,
      date: '2001-08-01',
      consumption: 1880.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4716,
      date: '2001-09-01',
      consumption: 1742.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4718,
      date: '2001-10-01',
      consumption: 1980.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4720,
      date: '2001-11-01',
      consumption: 1955.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4722,
      date: '2001-12-01',
      consumption: 1987.1,
      fuelSourceId: 1,
      siteId: 609,
    }),

    buildFakeConsumption({
      id: 4724,
      date: '2002-01-01',
      consumption: 2167.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4726,
      date: '2002-02-01',
      consumption: 1904.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4728,
      date: '2002-03-01',
      consumption: 1997.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4730,
      date: '2002-04-01',
      consumption: 1800.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4732,
      date: '2002-05-01',
      consumption: 1735.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4734,
      date: '2002-06-01',
      consumption: 1546.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4736,
      date: '2002-07-01',
      consumption: 1436.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4738,
      date: '2002-08-01',
      consumption: 1441.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4740,
      date: '2002-09-01',
      consumption: 1527.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4742,
      date: '2002-10-01',
      consumption: 1723.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4744,
      date: '2002-11-01',
      consumption: 1792.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4746,
      date: '2002-12-01',
      consumption: 1977.1,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4748,
      date: '2003-01-01',
      consumption: 190,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4750,
      date: '2003-02-01',
      consumption: 210,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4752,
      date: '2003-03-01',
      consumption: 220,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4754,
      date: '2003-04-01',
      consumption: 190,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4756,
      date: '2003-05-01',
      consumption: 370,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4758,
      date: '2003-06-01',
      consumption: 290,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4760,
      date: '2003-07-01',
      consumption: 280,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4762,
      date: '2003-08-01',
      consumption: 350,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4764,
      date: '2003-09-01',
      consumption: 290,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4766,
      date: '2003-10-01',
      consumption: 210,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4768,
      date: '2003-11-01',
      consumption: 280,
      fuelSourceId: 1,
      siteId: 609,
    }),
    buildFakeConsumption({
      id: 4770,
      date: '2003-12-01',
      consumption: 200,
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
      id: 3050,
      date: `2002-01-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 20,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 3052,
      date: `2002-02-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 80,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 3054,
      date: `2002-03-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 43,
      siteId: 609,
    }),

    buildFakeEmission({
      id: 3056,
      date: `2008-06-01`,
      fuelSourceId: 1,
      usedInId: 2,
      emissionFactor: 22,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 3058,
      date: `2008-06-01`,
      fuelSourceId: 2,
      usedInId: 2,
      emissionFactor: 126,
      siteId: 609,
    }),
    buildFakeEmission({
      id: 3060,
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
