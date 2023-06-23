import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('Businesses', function (table) {
    table.string('subscriptionDate').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  //EMPTY
}
