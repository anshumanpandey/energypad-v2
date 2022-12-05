import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('BusinessPatterns', function (table) {
    table.dropColumn('name');
    table.dropColumn('businessId');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('BusinessPatterns', function (table) {
    table.string('name', 255).notNullable().defaultTo('');
    table.integer('businessId', 255).notNullable().defaultTo(124);
  });
}
