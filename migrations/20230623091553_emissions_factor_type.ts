import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.float('conversionFactor').alter();
    table.float('emissionFactor').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.integer('conversionFactor').alter();
    table.integer('emissionFactor').alter();
  });
}
