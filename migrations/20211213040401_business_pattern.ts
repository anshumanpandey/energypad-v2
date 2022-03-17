import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable('BusinessService', 'BusinessPatterns');
  return knex.schema.alterTable('BusinessPatterns', function (table) {
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
    table.unique(['usedInId', 'siteId']);
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
