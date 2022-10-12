import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 236, email: 'mail236@mail.com' }),
    buildFakeBusiness({ id: 238, email: 'mail238@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 466, businessId: 236 }),
    buildFakeSite({ id: 468, businessId: 236 }),
  ]);
  await knex('Utilities').insert([
    {
      id: 204,
      name: 'Heat204',
      businessId: 236,
    },
  ]);
}
