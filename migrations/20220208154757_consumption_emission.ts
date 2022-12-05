import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('businessId');
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
  });
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropColumn('businessId');
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.unique(['siteId', 'fuelSourceId', 'year']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.integer('businessId', 255).notNullable().defaultTo(124);
    table.foreign('businessId').references('Businesses.id');
    table.dropForeign('siteId');
    table.dropColumn('siteId');
  });
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.integer('businessId', 255).notNullable().defaultTo(124);
    table.foreign('businessId').references('Businesses.id');
    table.dropForeign('siteId');
    table.dropColumn('siteId');
  });
}
