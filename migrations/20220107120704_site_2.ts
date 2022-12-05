import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('fuel');
    table.dropColumn('uses');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Sites', function (table) {
    table.string('fuel', 255).notNullable().defaultTo('');
    table.string('uses', 255).notNullable().defaultTo('');
  });
}
