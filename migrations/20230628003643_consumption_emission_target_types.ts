import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.float('totalCost').alter({ alterNullable: false });
    table.float('conversionFactor').alter({ alterNullable: false });
    table.float('vat').alter({ alterNullable: false });
  });

  await knex.schema.alterTable('UtilityEmissions', function (table) {
    table.float('conversionFactor').defaultTo(0).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.integer('totalCost').alter({ alterNullable: false });
    table.integer('conversionFactor').alter({ alterNullable: false });
    table.integer('vat').alter({ alterNullable: false });
  });
}
