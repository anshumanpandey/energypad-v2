import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 312, email: 'mail312@mail.com' }),
    buildFakeBusiness({ id: 316, email: 'mail316@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 474,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 312,
    },
    {
      id: 478,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 316,
    },
    {
      id: 479,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: true,
      workinghours: 2,
      size: 15,
      businessId: 316,
    },
    {
      id: 480,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 312,
    },
  ]);

  await knex('BusinessFuelsSize').insert([
    {
      id: 200,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 2,
    },

    {
      id: 202,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 3,
    },
  ]);
}
