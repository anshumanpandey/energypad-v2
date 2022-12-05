import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.float('consumption').notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('consumption');
  });
}
