import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('businessId');
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
  });
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropColumn('businessId');
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    table.unique(['siteId', 'fuelSourceId', 'year']);
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
