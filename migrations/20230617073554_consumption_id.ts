import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropTimestamps();
  });
  await knex.schema.alterTable('UtilityConsumptionsUse', function (table) {
    table.dropTimestamps();
    table.dropForeign('consumptionId');
  });
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.string('id', 26).alter({ alterNullable: false });
    table.timestamps(true, true);
  });
  await knex.schema.alterTable('UtilityConsumptionsUse', function (table) {
    table.string('consumptionId', 26).alter({ alterNullable: false });
    table.foreign('consumptionId').references('UtilityConsumptions.id').onDelete('CASCADE');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  //EMPTY
}
