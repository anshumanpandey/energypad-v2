import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.setNullable('totalArea').setNullable('totalPopulation');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.dropNullable('totalArea');
    table.dropNullable('totalPopulation');
  });
}
