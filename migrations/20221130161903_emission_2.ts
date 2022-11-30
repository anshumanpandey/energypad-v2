import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTable('UtilityEmissions');
  await knex.schema.createTable('UtilityEmissions', function (table) {
    table.increments('id');
    table.integer('totalCost').notNullable();
    table.integer('conversionFactor').notNullable();
    table.integer('kwhConversionFactor').notNullable();
    table.integer('emissionFactor').notNullable();
    table.integer('month').notNullable();
    table.integer('year').notNullable();

    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
    table.integer('fuelSourceId', 255).notNullable();
    table.foreign('fuelSourceId').references('FuelSources.id').onDelete('CASCADE');
    table.integer('usedInId', 255).notNullable();
    table.foreign('usedInId').references('FuelUses.id').onDelete('CASCADE');
    table.timestamps();
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
