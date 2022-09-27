import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('SiteConversionUnits', function (table) {
    table.increments('id').primary();
    table.string('unitType').notNullable();
    table.float('unitValue').notNullable();
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('SiteConversionUnits');
}
