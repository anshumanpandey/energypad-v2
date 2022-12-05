import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.string('currencyCode').notNullable();
    table.dropColumn('workingHoursStart');
    table.dropColumn('workingHoursEnd');
    table.dropColumn('holydayDate');
    table.dropColumn('totalArea');
    table.dropColumn('totalPopulation');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.dropColumn('currencyCode');
    table.integer('workingHoursStart', 255).notNullable().defaultTo(0);
    table.integer('workingHoursEnd', 255).notNullable().defaultTo(0);
    table.string('holydayDate', 255).nullable().defaultTo('');
    table.integer('totalArea').notNullable().defaultTo(0);
    table.integer('totalPopulation').notNullable().defaultTo(0);
  });
}
