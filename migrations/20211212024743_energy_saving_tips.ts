import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('EnergySavingTips', function (table) {
    table.increments('id');
    table.string('category').notNullable();
    table.string('text', 2500).notNullable();
    table.string('imageUrl').nullable();
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
