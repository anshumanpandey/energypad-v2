import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('TargetConsumption', function (table) {
    table.increments('id');
    table.string('date').notNullable();
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
  });
  await knex.schema.createTable('TargetConsumptionFuelConversion', function (table) {
    table.increments('id');
    table.float('targetValue').notNullable();
    table.string('fuelUnit').notNullable();
    table.integer('targetConsumptionId', 255).notNullable();
    table.foreign('targetConsumptionId').references('TargetConsumption.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('TargetConsumptionFuelConversion');
  await knex.schema.dropTable('TargetConsumption');
}
