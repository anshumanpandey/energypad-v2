import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 312, email: 'mail312@mail.com' }),
    buildFakeBusiness({ id: 316, email: 'mail316@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 474, businessId: 312 }),
    buildFakeSite({ id: 478, businessId: 316 }),
    buildFakeSite({ id: 479, businessId: 316 }),
    buildFakeSite({ id: 480, businessId: 312 }),
  ]);

  await knex('BusinessFuelsSize').insert([
    {
      id: 200,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 2,
    },

    {
      id: 202,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 3,
    },
  ]);
}
