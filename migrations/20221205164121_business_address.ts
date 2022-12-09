import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.string('address_1');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.dropColumn('address_1');
  });
}
