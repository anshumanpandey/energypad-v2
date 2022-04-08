import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable('FuelSources', function (table) {
      table.increments('id');
      table.string('source').notNullable();
      table.string('colorCode').notNullable();
    })
    .createTable('FuelUses', function (table) {
      table.increments('id');
      table.string('use').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
    })
    .createTable('BusinessFuelUses', function (table) {
      table.increments('id');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').deferrable('deferred');
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
      table.integer('usedInId', 255).notNullable();
      table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
    })
    .createTable('BusinessFuelsPricing', function (table) {
      table.increments('id');
      table.string('currencyCode').notNullable();
      table.integer('vat').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    })
    .createTable('BusinessFuelsSize', function (table) {
      table.increments('id');
      table.string('meters').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    })
    .dropTable('Brands')
    .dropTable('BrandDays')
    .createTable('BusinessBrands', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.string('startTime').notNullable();
      table.string('endTime').notNullable();
      table.integer('rate').notNullable();
      table.integer('days').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
