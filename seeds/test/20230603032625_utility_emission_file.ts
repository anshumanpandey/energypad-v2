import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 614, email: 'mail614@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 604, businessId: 614, name: 'Site 604' })]);
}
