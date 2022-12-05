import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('Countries', function (table) {
    table.increments('id');
    table.string('name', 255).notNullable();
  });

  await knex.schema.createTable('States', function (table) {
    table.increments('id');
    table.string('name', 255).notNullable();
    table.integer('countryId', 255).notNullable();
    table.foreign('countryId').references('Countries.id').onDelete('CASCADE');
  });
  await knex.schema.alterTable('Businesses', function (table) {
    table.integer('countryId', 255).notNullable();
    table.foreign('countryId').references('Countries.id');
    table.integer('stateId', 255).notNullable();
    table.foreign('stateId').references('States.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.dropForeign('countryId');
    table.dropColumn('countryId');
    table.dropForeign('stateId');
    table.dropColumn('stateId');
  });
  return knex.schema.dropTable('States').dropTable('Countries');
}
