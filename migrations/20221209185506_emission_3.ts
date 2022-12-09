import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.integer('population');
    table.integer('fullTimeEmployeeHours');
    table.boolean('buidingExtension');
    table.boolean('changeBuildingLocation');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('population');
    table.dropColumn('fullTimeEmployeeHours');
    table.dropColumn('buidingExtension');
    table.dropColumn('changeBuildingLocation');
  });
}
