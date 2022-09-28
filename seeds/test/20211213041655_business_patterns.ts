import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 434, email: 'mail434@mail.com' }),
    buildFakeBusiness({ id: 124, email: 'mail7788@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 353,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 434,
    },
  ]);
}
