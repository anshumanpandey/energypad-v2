import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.integer('workingHoursStart', 255).notNullable();
    table.integer('workingHoursEnd', 255).notNullable();
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
