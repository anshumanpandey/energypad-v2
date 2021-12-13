import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable('Reviews', function (table) {
      table.increments('id');
      table.string('question').notNullable();
      table.integer('siteId', 255).notNullable();
      table.foreign('siteId').references('Sites.id').deferrable('deferred').onDelete('CASCADE');
    })
    .createTable('ReviewsAnswers', function (table) {
      table.increments('id');
      table.string('answer').notNullable();
      table.integer('reviewId').notNullable();
      table.foreign('reviewId').references('Reviews.id').deferrable('deferred').onDelete('CASCADE');
    });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
