import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  await knex('FuelSources').insert([
    { id: 1, source: 'Electricity' },
    { id: 2, source: 'Gas' },
  ]);
  await knex('FuelUses').insert([
    { id: 1, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);
}
