import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('siteId');
    table.dropColumn('usedInId');
    table.dropColumn('utilityId');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    table.integer('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.integer('siteId', 255).notNullable().defaultTo(89);
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable().defaultTo(2);
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.integer('utilityId').notNullable().defaultTo(124);
    table.foreign('utilityId').references('Utilities.id').deferrable('deferred');

    table.dropForeign('fuelSourceId');
    table.dropColumn('fuelSourceId');
    table.dropForeign('businessId');
    table.dropColumn('businessId');
  });
}
