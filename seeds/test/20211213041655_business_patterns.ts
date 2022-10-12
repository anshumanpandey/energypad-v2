import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 434, email: 'mail434@mail.com' }),
    buildFakeBusiness({ id: 124, email: 'mail7788@mail.com' }),
  ]);

  await knex('Sites').insert([buildFakeSite({ id: 353, businessId: 434 })]);
}
