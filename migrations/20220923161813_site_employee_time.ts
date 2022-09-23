import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Sites', function (table) {
    table.boolean('fullTimeEmployee').nullable().defaultTo(false);
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
