import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('EnergySavingTipsToBusiness', function (table) {
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('EnergySavingTipsToBusiness', function (table) {
    table.dropColumn('siteId');
  });
}
