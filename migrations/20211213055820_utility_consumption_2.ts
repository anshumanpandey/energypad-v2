import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropForeign('siteId');
    table.dropColumn('siteId');
    table.dropForeign('usedInId');
    table.dropColumn('usedInId');
  });
}
