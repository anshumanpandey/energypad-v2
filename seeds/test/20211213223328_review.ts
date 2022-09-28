import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 232, email: 'mail232@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 460,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 232,
    },
    {
      id: 462,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 232,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 200,
      name: 'Heat200',
      businessId: 232,
    },
  ]);

  await knex('Businesses').insert([buildFakeBusiness({ id: 234, email: 'mail234@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 464,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 234,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 202,
      name: 'Heat202',
      businessId: 234,
    },
  ]);
}
