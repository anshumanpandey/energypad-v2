import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  const record = await knex('FuelSources').insert([{ id: 1, source: 'Electricity' }]);
  await knex('FuelUses').insert([
    { id: 1, use: 'Cooling', fuelSourceId: record[0] },
    { id: 2, use: 'Heating', fuelSourceId: record[0] },
    { id: 3, use: 'Lighting', fuelSourceId: record[0] },
    { id: 4, use: 'Powering', fuelSourceId: record[0] },
  ]);
}
