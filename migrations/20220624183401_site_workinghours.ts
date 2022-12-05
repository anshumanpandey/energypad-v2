import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Sites', function (table) {
    table.integer('workinghours').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('workinghours');
  });
}
