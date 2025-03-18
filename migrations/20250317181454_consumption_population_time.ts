import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.float('population').defaultTo(0)
    table.float('workingHours').defaultTo(0)
  });

  await knex.schema.alterTable('Sites', function (table) {
    table.dropColumn('workinghours');
    table.dropColumn('population');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('population');
    table.dropColumn('workingHours');
  });

  await knex.schema.alterTable('Sites', function (table) {
    table.integer('workinghours').defaultTo(0);
    table.integer('population').defaultTo(0);
  });
}
