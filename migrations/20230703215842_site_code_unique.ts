import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.dropUnique(['name']);
    table.unique(['businessId', 'code']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.dropUnique(['businessId', 'code']);
    table.unique(['name']);
  });
}
