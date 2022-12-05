import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 410, email: 'mail410@mail.com' })]);

  await knex('Sites').insert([
    buildFakeSite({ id: 560, businessId: 410, name: 'Site 560' }),
    buildFakeSite({ id: 562, businessId: 410, name: 'Site 562' }),
    buildFakeSite({ id: 564, businessId: 410, name: 'Site 564' }),
  ]);
}
