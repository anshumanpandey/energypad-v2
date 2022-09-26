import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('BusinessFuelsSize', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });

  await knex.schema.alterTable('BusinessFuelsPricing', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });

  await knex.schema.alterTable('BusinessBrands', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('BusinessFuelsSize').dropTable('BusinessFuelsPricing').dropTable('BusinessBrands');
}
