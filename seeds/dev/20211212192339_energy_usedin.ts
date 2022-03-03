import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  const record = await knex('FuelSources').insert([
    { id: 1, source: 'Electricity' },
    { id: 2, source: 'Gas' },
  ]);
  await knex('FuelUses').insert([
    { id: 1, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);

  await knex('UsedInToFuelSource').insert([
    { id: 1, usedInId: 1, fuelSourceId: record[0] },
    { id: 2, usedInId: 2, fuelSourceId: record[0] },
    { id: 3, usedInId: 3, fuelSourceId: record[0] },
    { id: 4, usedInId: 4, fuelSourceId: record[0] },
  ]);
}
