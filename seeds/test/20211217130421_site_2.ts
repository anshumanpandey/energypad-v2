import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 240, email: 'mail240@mail.com' }),
    buildFakeBusiness({ id: 242, email: 'mail242@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 470, businessId: 240 }),
    buildFakeSite({ id: 472, businessId: 240 }),
  ]);

  await knex('Floors').insert([
    {
      id: 10,
      size: 'some',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
    {
      id: 12,
      size: 'some2',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
  ]);
}
