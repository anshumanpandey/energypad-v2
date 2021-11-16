import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('Utilities', function (table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.integer('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id').deferrable('deferred');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
