import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable('Brands', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.string('startTime').notNullable();
      table.string('endTime').notNullable();
      table.integer('rate').notNullable();
      table.integer('businessId', 255).notNullable();
      table.foreign('businessId').references('Businesses.id').deferrable('deferred');
    })
    .createTable('BrandDays', function (table) {
      table.increments('id');
      table.string('name').notNullable();
      table.integer('brandId').notNullable();
      table.foreign('brandId').references('Brands.id').deferrable('deferred').onDelete('CASCADE');
    });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
