import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 236, email: 'mail236@mail.com' }),
    buildFakeBusiness({ id: 238, email: 'mail238@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 466,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 236,
    },
    {
      id: 468,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 236,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 204,
      name: 'Heat204',
      businessId: 236,
    },
  ]);
}
