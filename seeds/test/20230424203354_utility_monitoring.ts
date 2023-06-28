import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite, buildFakeUtilityMonitoring } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 610, email: 'mail610@mail.com' }),
    buildFakeBusiness({ id: 611, email: 'mail611@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 602, businessId: 610, name: 'Site 602' }),
    buildFakeSite({ id: 603, businessId: 611, name: 'Site 603' }),
  ]);

  await knex('UtilityMonitoring').insert([
    buildFakeUtilityMonitoring({ id: 100, date: '2020-01-01', carbon: 22, fuelSourceId: 2, siteId: 603 }),
    buildFakeUtilityMonitoring({ id: 102, date: '2020-01-01', carbon: 10, fuelSourceId: 3, siteId: 603 }),
    buildFakeUtilityMonitoring({ id: 104, date: '2020-03-01', carbon: 10, fuelSourceId: 4, siteId: 603 }),
  ]);
}
