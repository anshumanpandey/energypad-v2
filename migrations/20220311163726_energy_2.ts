import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.renameTable('UsedInToFuelSource', 'UsedInToFuelSourceToSite');
  return knex.schema.alterTable('UsedInToFuelSourceToSite', function (table) {
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
