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
      table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    })
    .createTable('BusinessFuelUses', function (table) {
      table.increments('id');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id');
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
      table.integer('usedInId', 255).notNullable();
      table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    })
    .createTable('BusinessFuelsPricing', function (table) {
      table.increments('id');
      table.string('currencyCode').notNullable();
      table.integer('vat').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    })
    .createTable('BusinessFuelsSize', function (table) {
      table.increments('id');
      table.string('meters').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    })
    .dropTable('BrandDays')
    .dropTable('Brands')
    .createTable('BusinessBrands', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.string('startTime').notNullable();
      table.string('endTime').notNullable();
      table.integer('rate').notNullable();
      table.string('days').notNullable();
      table.integer('fuelSourceId', 255).notNullable();
      table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTable('BusinessBrands')
    .dropTable('BusinessFuelsSize')
    .dropTable('BusinessFuelsPricing')
    .dropTable('BusinessFuelUses')
    .dropTable('FuelUses')
    .dropTable('FuelSources');
  await knex.schema
    .createTable('Brands', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.string('startTime').notNullable();
      table.string('endTime').notNullable();
      table.integer('rate').notNullable();
      table.integer('businessId', 255).notNullable();
      table.foreign('businessId').references('Businesses.id').deferrable('deferred');
    })
    .createTable('BrandDays', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.integer('brandId').notNullable();
      table.foreign('brandId').references('Brands.id').onDelete('CASCADE');
    });
}
