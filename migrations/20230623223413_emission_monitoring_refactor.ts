import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropTimestamps();
  });
  await knex.schema.alterTable('UtilityMonitoring', function (table) {
    table.dropTimestamps();
  });

  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.timestamps(false, true);
  });
  await knex.schema.alterTable('UtilityMonitoring', function (table) {
    table.timestamps(false, true);
    table.dropUnique(['siteId', 'fuelSourceId', 'date', 'fuelUnit']);
    table.unique(['date', 'siteId', 'fuelSourceId']);
  });
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.unique(['date', 'siteId', 'fuelSourceId']);
  });
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.unique(['date', 'siteId', 'fuelSourceId']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropUnique(['date', 'siteId', 'fuelSourceId']);
  });
  await knex.schema.alterTable('UtilityMonitoring', function (table) {
    table.unique(['date', 'siteId', 'fuelSourceId', 'fuelUnit']);
    table.dropUnique(['date', 'siteId', 'fuelSourceId']);
  });
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropUnique(['date', 'siteId', 'fuelSourceId']);
  });
}
