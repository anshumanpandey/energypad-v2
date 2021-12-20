import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('siteId');
    table.dropColumn('usedInId');
    table.dropColumn('utilityId');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
    table.integer('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id').deferrable('deferred');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
