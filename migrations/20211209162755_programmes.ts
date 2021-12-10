import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable('Programmes', function (table) {
      table.increments('id');
      table.string('question').notNullable();
      table.integer('utilityId').notNullable();
      table.foreign('utilityId').references('Utilities.id').deferrable('deferred');
    })
    .createTable('ProgrammeAnswers', function (table) {
      table.increments('id');
      table.string('answer').notNullable();
      table.integer('programmeId').notNullable();
      table.foreign('programmeId').references('Programmes.id').deferrable('deferred').onDelete('CASCADE');
    });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
