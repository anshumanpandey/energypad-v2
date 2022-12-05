import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable('BusinessService', 'BusinessPatterns');
  return knex.schema.alterTable('BusinessPatterns', function (table) {
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.unique(['usedInId', 'siteId', 'startDate', 'endDate']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('BusinessPatterns', function (table) {
    table.dropUnique(['usedInId', 'siteId', 'startDate', 'endDate']);
    table.dropForeign('usedInId');
    table.dropColumn('usedInId');
    table.dropForeign('siteId');
    table.dropColumn('siteId');
  });
  await knex.schema.renameTable('BusinessPatterns', 'BusinessService');
}
