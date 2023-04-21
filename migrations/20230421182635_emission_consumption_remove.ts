import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropColumn('consumption');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.integer('consumption').notNullable().defaultTo(0);
  });
}
