import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 310, email: 'mail310@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 640, businessId: 310 })]);

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
