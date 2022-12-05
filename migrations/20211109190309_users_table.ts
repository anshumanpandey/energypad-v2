import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable('Businesses', function (table) {
      table.increments('id').primary();
      table.string('businessName', 255).notNullable();
      table.string('businessType', 255).notNullable();
      table.string('businessService', 255).notNullable();
      table.string('password', 255).notNullable();
      table.string('siteName', 255).notNullable();
      table.string('buildingName', 255).notNullable();
      table.string('contactName', 255).notNullable();
      table.string('position', 255).notNullable();
      table.string('phoneNumber', 255).notNullable();
      table.string('email', 255).notNullable();
      table.string('town', 255).notNullable();
      table.string('postCode', 255).notNullable();
      table.string('subscriptionDate', 255).notNullable();
      table.string('holydayDate', 255).nullable();
      table.integer('totalArea').notNullable();
      table.integer('totalPopulation').notNullable();
    })
    .createTable('Floors', function (table) {
      table.increments('id');
      table.string('size', 255).notNullable();
      table.integer('area').notNullable();
      table.integer('population').notNullable();
      table.integer('businessId', 255).notNullable();
      table.foreign('businessId').references('Businesses.id').deferrable('deferred');
    })
    .createTable('BusinessService', function (table) {
      table.increments('id');
      table.string('name', 255).notNullable();
      table.string('startDate', 255).notNullable();
      table.string('endDate', 255).notNullable();
      table.integer('consumption').notNullable();
      table.integer('daysOnYear').notNullable();
      table.integer('businessId', 255).notNullable();
      table.foreign('businessId').references('Businesses.id').deferrable('deferred');
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('BusinessService').dropTable('Floors').dropTable('Businesses');
}
