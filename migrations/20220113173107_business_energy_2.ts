import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('BusinessFuelsSize', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
  });

  await knex.schema.alterTable('BusinessFuelsPricing', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
  });

  await knex.schema.alterTable('BusinessBrands', function (table) {
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
