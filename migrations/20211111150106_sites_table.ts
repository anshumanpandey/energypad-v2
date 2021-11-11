import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('Sites', function (table) {
    table.increments('id').primary();
    table.string('type', 255).notNullable();
    table.string('address', 255).notNullable();
    table.string('postCode', 255).notNullable();
    table.string('town', 255).notNullable();
    table.integer('population').notNullable();
    table.integer('size').notNullable();
    table.string('fuel', 255).notNullable();
    table.string('uses', 255).notNullable();
    table.string('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id').deferrable('deferred');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
