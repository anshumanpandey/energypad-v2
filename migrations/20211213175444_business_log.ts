import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('BusinessLog', function (table) {
    table.increments('id');
    table.string('startDate').notNullable();
    table.string('endDate').notNullable();
    table.string('comments', 2500).notNullable();
    table.string('operation').notNullable();
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('BusinessLog');
}
