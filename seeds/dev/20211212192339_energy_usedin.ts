import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  await knex('FuelSources').insert([
    { id: 1, source: 'Grid Electricity' },
    { id: 2, source: 'Gas' },
    { id: 3, source: 'Solar PV' },
    { id: 4, source: 'Petrol' },
    { id: 5, source: 'Diesel' },
    { id: 6, source: 'Bio Diesel' },
  ]);
  await knex('FuelUses').insert([
    { id: 1, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);
}
