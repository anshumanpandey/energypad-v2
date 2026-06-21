import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('UtilityToDriver', function (table) {
    table.increments('id');
    // can be R or NR
    table.string('driver');

    // can be Heating, Cooling, Population, OperatingHours, Daylight, BuildingSize
    table.string('category');

    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');

    table.unique(['driver', 'category', 'siteId']);
  });

  await knex.schema.alterTable('TargetConsumptionFuelConversion', function (table) {
    table.dropForeign("targetConsumptionId")
  });
  
  await knex.schema.alterTable('TargetConsumption', function (table) {
    table.string('id', 26).alter({ alterNullable: false });
  });

  await knex.schema.alterTable('TargetConsumptionFuelConversion', function (table) {
    table.string('targetConsumptionId', 26).alter({ alterNullable: false });
    table.foreign('targetConsumptionId').references('TargetConsumption.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('UtilityToDriver');
}
