import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 620, email: 'mail620@mail.com' }),
    buildFakeBusiness({ id: 622, email: 'mail622@mail.com' }),
  ]);
}
