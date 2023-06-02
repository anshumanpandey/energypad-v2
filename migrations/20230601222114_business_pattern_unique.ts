import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('BusinessPatterns', function (table) {
    table.dropColumn('consumption');
    table.integer('temperature').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('BusinessPatterns', function (table) {
    table.integer('consumption').nullable();
    table.dropColumn('temperature');
  });
}
