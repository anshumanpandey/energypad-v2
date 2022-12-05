import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.string('conversionUnit').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('UtilityConsumptions', function (table) {
    table.dropColumn('conversionUnit');
  });
}
