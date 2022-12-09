import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeConsumption, buildFakeEmission, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 310, email: 'mail310@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 640, businessId: 310 })]);

  await knex('UtilityEmissions').insert([
    buildFakeEmission({
      id: 100,
      date: '2016-08-01',
      fuelSourceId: 1,
      usedInId: 2,
      siteId: 640,
    }),
    buildFakeEmission({
      id: 102,
      date: '2019-08-01',
      fuelSourceId: 1,
      usedInId: 2,
      siteId: 640,
    }),
  ]);

  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 300,
      date: '2001-01-01',
      consumption: 100,
      fuelSourceId: 1,
      siteId: 640,
    }),
    buildFakeConsumption({
      id: 302,
      date: '2001-02-01',
      consumption: 100,
      fuelSourceId: 1,
      siteId: 640,
    }),
  ]);
}
