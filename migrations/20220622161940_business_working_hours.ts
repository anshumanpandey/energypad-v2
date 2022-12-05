import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.integer('workingHoursStart', 255).notNullable();
    table.integer('workingHoursEnd', 255).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.dropColumn('workingHoursStart');
    table.dropColumn('workingHoursEnd');
  });
}
