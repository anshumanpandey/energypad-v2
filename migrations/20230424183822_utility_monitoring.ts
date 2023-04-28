import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('UtilityMonitoring', function (table) {
    table.increments('id').primary();

    table.float('energy').notNullable();
    table.float('carbon').notNullable();
    table.float('conversionFactor').notNullable();
    table.string('fuelUnit').notNullable();
    table.string('date').notNullable();

    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');

    table.unique(['siteId', 'fuelSourceId', 'date', 'fuelUnit']);

    table.timestamps();
  });

  await knex.schema.createTable('UtilityMonitoringToUseInId', function (table) {
    table.increments('id').primary();

    table.integer('monitoringId', 255).notNullable();
    table.foreign('monitoringId').references('UtilityMonitoring.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');

    table.timestamps();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('UtilityMonitoringToUseInId');
  await knex.schema.dropTableIfExists('UtilityMonitoring');
}
