import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('EnergySavingTips', function (table) {
    table.increments('id');
    table.string('category').notNullable();
    table.string('text', 2500).notNullable();
    table.string('imageUrl').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('EnergySavingTips');
}
