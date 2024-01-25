import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 800, email: 'mail800@mail.com' })]);

  await knex('Sites').insert([
    buildFakeSite({ id: 802, businessId: 800, name: 'Main Building RR', code: '20_London52', vat: 12.37 }),
    buildFakeSite({ id: 804, businessId: 800, name: 'Main Building HH', code: '60_Ben52' }),
  ]);
}
