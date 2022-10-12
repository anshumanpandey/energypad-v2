import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 228, email: 'mail228@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 456, businessId: 228, name: 'Site 456' })]);
  await knex('Utilities').insert([
    {
      id: 196,
      name: 'Heat196',
      businessId: 228,
    },
  ]);

  await knex('Businesses').insert([buildFakeBusiness({ id: 230, email: 'mail230@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 458, businessId: 230, name: 'Site 458' })]);
  await knex('Utilities').insert([
    {
      id: 198,
      name: 'Heat198',
      businessId: 230,
    },
  ]);
}
