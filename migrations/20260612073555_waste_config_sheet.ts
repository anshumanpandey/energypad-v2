import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('UtilityToDriver', function (table) {

    // can be R or NR
    table.string("driver")

    // can be Heating, Cooling, Population, OperatingHours, Daylight, BuildingSize
    table.string("category")

    table.integer('siteId', 255).notNullable();
    table.foreign('siteId').references('Sites.id').onDelete('CASCADE');
  });

}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('UtilityToDriver');
}
