import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropUnique(['date', 'siteId', 'fuelSourceId']);
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.dropColumn('fullTimeEmployeeHours');
    table.dropColumn('buidingExtension');
    table.dropColumn('changeBuildingLocation');
    table.dropColumn('population');
  });

  await knex.schema.dropTable('UtilityConsumptionsUse');
  await knex.schema.dropTable('UtilityEmissionsUse');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.unique(['date', 'siteId', 'fuelSourceId', '']);
  });

  await knex.schema.alterTable('UtilityConsumptionsUse', function (table) {
    table.increments('id');
    table.string('consumptionId', 26).alter({ alterNullable: false });
    table.foreign('consumptionId').references('UtilityConsumptions.id').onDelete('CASCADE');

    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('UtilityEmissionsUse', function (table) {
    table.increments('id');
    table.integer('emissionId', 255).notNullable();
    table.foreign('emissionId').references('UtilityEmissions.id').onDelete('CASCADE');

    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.timestamps(true, true);
  });
}
