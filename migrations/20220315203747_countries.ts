import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('Countries', function (table) {
    table.increments('id');
    table.string('name', 255).notNullable();
  });

  await knex.schema.createTable('States', function (table) {
    table.increments('id');
    table.string('name', 255).notNullable();
    table.integer('countryId', 255).notNullable();
    table.foreign('countryId').references('Countries.id').deferrable('deferred').onDelete('CASCADE');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
