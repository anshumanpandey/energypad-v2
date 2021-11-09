import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('Users', function (table) {
    table.increments('id');
    table.string('address', 255).notNullable();
    table.string('email', 255).notNullable();
    table.string('password', 255).notNullable();
    table.string('sites', 255).notNullable();
    table.string('bussinesName', 255).notNullable();
    table.string('propertyName', 255).notNullable();
    table.string('postCode', 255).notNullable();
    table.string('town', 255).notNullable();
    table.integer('population').notNullable();
    table.integer('size').notNullable();
    table.string('fuel', 255).notNullable();
    table.string('uses', 255).notNullable();
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
