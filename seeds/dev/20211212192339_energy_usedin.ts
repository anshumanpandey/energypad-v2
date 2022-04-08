import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  await knex('FuelSources').insert([
    { id: 1, source: 'Grid Electricity', colorCode: '#4989C6' },
    { id: 2, source: 'Gas', colorCode: '#7F9EAE' },
    { id: 3, source: 'Solar PV', colorCode: '#F5B363' },
    { id: 4, source: 'Petrol', colorCode: '#4D505C' },
    { id: 5, source: 'Diesel', colorCode: '#E97871' },
    { id: 6, source: 'Bio Diesel', colorCode: '#68D8DC' },
  ]);
  await knex('FuelUses').insert([
    { id: 1, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);
}
