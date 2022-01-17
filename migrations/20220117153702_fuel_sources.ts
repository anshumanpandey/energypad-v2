import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('FuelUses', function (table) {
    table.dropColumn('fuelSourceId');
  });
  await knex.schema.createTable('UsedInToFuelSource', function (table) {
    table.increments('id');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').deferrable('deferred').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').deferrable('deferred').onDelete('CASCADE');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
