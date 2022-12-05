import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('UtilityEmissions', function (table) {
    table.increments('id');
    table.string('year').notNullable();
    table.integer('value').notNullable();
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('UtilityEmissions');
}
