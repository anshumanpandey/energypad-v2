import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('FuelUses', function (table) {
    table.dropColumn('fuelSourceId');
  });
  await knex.schema.createTable('UsedInToFuelSource', function (table) {
    table.increments('id');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('FuelUses', function (table) {
    table.integer('fuelSourceId', 255).notNullable().defaultTo(1);
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
  });

  await knex.schema.dropTable('UsedInToFuelSource');
}
