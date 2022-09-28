import { Knex } from 'knex';
import { buildFakeBusiness } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 198, email: 'mail198@mail.com' }),
    buildFakeBusiness({ id: 212, email: 'mail212@mail.com' }),
    buildFakeBusiness({ id: 218, email: 'mail218@mail.com' }),
    buildFakeBusiness({ id: 302, email: 'userdashboard302@mail.com' }),
    buildFakeBusiness({ id: 222, email: 'userdashboard1@mail.com' }),
  ]);

  await knex('Sites').insert([
    {
      id: 441,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      workinghours: 2,
      fullTimeEmployee: false,
      size: 15,
      businessId: 198,
    },
    {
      id: 448,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 212,
    },
    {
      id: 450,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 222,
    },
    {
      id: 451,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 302,
    },
    {
      id: 89,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 198,
    },
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
    {
      id: 22,
      date: '2020-01-01',
      consumption: 100,
      cost: 100,
      fuelSourceId: 1,
      siteId: 451,
    },
    {
      id: 24,
      date: '2020-02-01',
      consumption: 150,
      cost: 200,
      fuelSourceId: 1,
      siteId: 451,
    },
    {
      id: 26,
      date: '2020-03-01',
      consumption: 150,
      cost: 200,
      fuelSourceId: 1,
      siteId: 451,
    },
  ]);
}
