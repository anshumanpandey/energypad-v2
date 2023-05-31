import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.integer('stateId').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.integer('stateId', 255).notNullable().alter();
  });
}
