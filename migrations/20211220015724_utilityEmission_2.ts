import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropColumn('usedInId');
    table.dropColumn('siteId');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    table.integer('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropForeign('fuelSourceId');
    table.dropColumn('fuelSourceId');
    table.dropForeign('businessId');
    table.dropColumn('businessId');
  });
}
