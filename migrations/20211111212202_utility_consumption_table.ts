import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('UtilityConsumptions', function (table) {
    table.increments('id').primary();
    table.string('date', 255).notNullable();
    table.integer('consumption').notNullable();
    table.float('cost').notNullable();
    table.integer('utilityId').notNullable();
    table.foreign('utilityId').references('Utilities.id').deferrable('deferred');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('UtilityConsumptions');
}
