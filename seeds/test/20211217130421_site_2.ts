import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 240, email: 'mail240@mail.com' }),
    buildFakeBusiness({ id: 242, email: 'mail242@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 470,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 240,
    },
    {
      id: 472,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 240,
    },
  ]);

  await knex('Floors').insert([
    {
      id: 10,
      size: 'some',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
    {
      id: 12,
      size: 'some2',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
  ]);
}
