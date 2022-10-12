import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 232, email: 'mail232@mail.com' })]);

  await knex('Sites').insert([
    buildFakeSite({ id: 460, businessId: 232 }),
    buildFakeSite({ id: 462, businessId: 232 }),
  ]);
  await knex('Utilities').insert([
    {
      id: 200,
      name: 'Heat200',
      businessId: 232,
    },
  ]);

  await knex('Businesses').insert([buildFakeBusiness({ id: 234, email: 'mail234@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 464, businessId: 234 })]);
  await knex('Utilities').insert([
    {
      id: 202,
      name: 'Heat202',
      businessId: 234,
    },
  ]);
}
