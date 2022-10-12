import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 400, email: 'mail400@mail.com' }),
    buildFakeBusiness({ id: 402, email: 'mail402@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 550, businessId: 400 }),
    buildFakeSite({ id: 552, businessId: 402 }),
  ]);

  await knex('SiteConversionUnits').insert([
    {
      unitType: 'L',
      unitValue: 23.77,
      siteId: 552,
    },
    {
      unitType: 'm3',
      unitValue: 0.48,
      siteId: 552,
    },
  ]);
}
