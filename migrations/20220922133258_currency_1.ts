import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('Businesses', function (table) {
    table.string('currencyCode').nullable();
    table.dropColumn('workingHoursStart');
    table.dropColumn('workingHoursEnd');
    table.dropColumn('holydayDate');
    table.dropColumn('totalArea');
    table.dropColumn('totalPopulation');
  });
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export async function down(): Promise<void> {}
