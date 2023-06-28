import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.float('vat').defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('vat');
  });
}
