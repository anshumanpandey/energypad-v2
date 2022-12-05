import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.string('name').notNullable().unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('name');
  });
}
