import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  const fuel1 = { id: 1, source: 'Grid Electricity', colorCode: '#4989C6' };
  await knex('FuelSources').insert([
    fuel1,
    { id: 2, source: 'Gas', colorCode: '#7F9EAE' },
    { id: 3, source: 'Solar PV', colorCode: '#F5B363' },
    { id: 4, source: 'Petrol', colorCode: '#4D505C' },
    { id: 5, source: 'Diesel', colorCode: '#E97871' },
    { id: 6, source: 'Bio Diesel', colorCode: '#68D8DC' },
  ]);
  await knex('FuelUses').insert([
    { id: 105, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);

  await knex('Businesses').insert([buildFakeBusiness({ id: 148, email: 'mail482@mail.com' })]);

  await knex('Sites').insert([
    {
      id: 101,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 148,
    },
  ]);
}
