import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 400, email: 'mail400@mail.com' }),
    buildFakeBusiness({ id: 402, email: 'mail402@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 550,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 400,
    },
    {
      id: 552,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 402,
    },
  ]);

  await knex('SiteConversionUnits').insert([
    {
      unitType: 'L',
      unitValue: 23.77,
      siteId: 552,
    },
    {
      unitType: 'm3',
      unitValue: 0.48,
      siteId: 552,
    },
  ]);
}
