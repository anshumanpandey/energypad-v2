import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.unique(['date', 'fuelSourceId', 'siteId']);
  });
}

export async function down(knex: Knex): Promise<void> {
}
