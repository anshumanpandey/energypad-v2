import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.integer('countryId', 255);
    table.foreign('countryId').references('Countries.id');
    table.integer('stateId', 255);
    table.foreign('stateId').references('States.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('countryId');
    table.dropColumn('stateId');
  });
}
