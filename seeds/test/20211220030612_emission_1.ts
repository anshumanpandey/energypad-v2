import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 310, email: 'mail310@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 640,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 310,
    },
  ]);

  await knex('UtilityEmissions').insert([
    {
      year: 2010,
      value: 200,
      fuelSourceId: 1,
      siteId: 640,
    },
    {
      year: 2011,
      value: 200,
      fuelSourceId: 1,
      siteId: 640,
    },
  ]);

  await knex('UtilityConsumptions').insert([
    {
      date: '2001-01-01',
      consumption: 100,
      cost: 100,
      fuelSourceId: 1,
      siteId: 640,
    },
    {
      date: '2001-02-01',
      consumption: 100,
      cost: 100,
      fuelSourceId: 1,
      siteId: 640,
    },
  ]);
}
