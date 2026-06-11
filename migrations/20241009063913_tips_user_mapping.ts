import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('EnergySavingTipsToBusiness', function (table) {
    table.integer('businessId', 255).notNullable();
    table.foreign('businessId').references('Businesses.id').deferrable('deferred');

    table.integer('tipId', 255).notNullable();
    table.foreign('tipId').references('EnergySavingTips.id').deferrable('deferred');

    table.integer('month', 255).notNullable();
    table.string('use').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('EnergySavingTipsToBusiness');
}
