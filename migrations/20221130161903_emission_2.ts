import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.dropUnique(['siteId', 'fuelSourceId', 'year']);
    table.dropColumn('value');
    table.dropColumn('year');
    table.integer('conversionFactor').notNullable();
    table.integer('consumption').notNullable();
    table.string('fuelUnit').notNullable();
    table.integer('emissionFactor').notNullable();
    table.string('date').notNullable();

    table.timestamps();
  });
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('conversionUnit');
    table.dropColumn('cost');
    table.integer('conversionFactor').notNullable();
    table.string('fuelUnit').notNullable();
    table.integer('vat').notNullable();

    table.timestamps();
  });
  await knex.schema.createTable('UtilityConsumptionsUse', function (table) {
    table.increments('id');

    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.integer('consumptionId', 255).notNullable();
    table.foreign('consumptionId').references('UtilityConsumptions.id').onDelete('CASCADE');
    table.timestamps();
  });
  await knex.schema.createTable('UtilityEmissionsUse', function (table) {
    table.increments('id');

    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.integer('emissionId', 255).notNullable();
    table.foreign('emissionId').references('UtilityEmissions.id').onDelete('CASCADE');

    table.timestamps();
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.string('year').notNullable().defaultTo('');
    table.integer('value').notNullable().defaultTo(0);
    table.dropColumn('fuelUnit');
    table.dropColumn('consumption');
    table.dropColumn('conversionFactor');
    table.dropColumn('emissionFactor');
    table.dropColumn('date');

    table.dropTimestamps();
  });

  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.string('conversionUnit').nullable().defaultTo('');
    table.float('cost').notNullable().defaultTo(0);

    table.dropColumn('fuelUnit');
    table.dropColumn('conversionFactor');
    table.dropColumn('vat');

    table.dropTimestamps();
  });
  await knex.schema.dropTable('UtilityConsumptionsUse');
  await knex.schema.dropTable('UtilityEmissionsUse');
}
