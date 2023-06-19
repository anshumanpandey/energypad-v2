import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeConsumption, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 198, email: 'mail198@mail.com' }),
    buildFakeBusiness({ id: 212, email: 'mail212@mail.com' }),
    buildFakeBusiness({ id: 218, email: 'mail218@mail.com' }),
    buildFakeBusiness({ id: 302, email: 'userdashboard302@mail.com' }),
    buildFakeBusiness({ id: 222, email: 'userdashboard1@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 441, businessId: 198 }),
    buildFakeSite({ id: 448, businessId: 212, name: 'site AA' }),
    buildFakeSite({ id: 450, businessId: 222 }),
    buildFakeSite({ id: 451, businessId: 302 }),
    buildFakeSite({ id: 89, businessId: 198 }),
  ]);

  await knex('Utilities').insert([
    {
      id: 498,
      name: 'Heat',
      businessId: 198,
    },
    {
      id: 124,
      name: 'Gas',
      businessId: 212,
    },
    {
      id: 184,
      name: 'Gas 2',
      businessId: 218,
    },
    {
      id: 186,
      name: 'Gas 3',
      businessId: 222,
    },
  ]);

  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 5200,
      date: '2020-01-01',
      siteId: 451,
      consumption: 100,
      fuelSourceId: 1,
    }),
    buildFakeConsumption({
      id: 5202,
      date: '2020-02-01',
      consumption: 150,
      fuelSourceId: 1,
      siteId: 451,
    }),
    buildFakeConsumption({
      id: 5206,
      date: '2020-03-01',
      consumption: 150,
      fuelSourceId: 1,
      siteId: 451,
    }),
  ]);
}
