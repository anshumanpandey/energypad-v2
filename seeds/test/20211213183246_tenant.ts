import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 228, email: 'mail228@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 456,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 228,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 196,
      name: 'Heat196',
      businessId: 228,
    },
  ]);

  await knex('Businesses').insert([buildFakeBusiness({ id: 230, email: 'mail230@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 458,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 230,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 198,
      name: 'Heat198',
      businessId: 230,
    },
  ]);
}
