import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 310,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail310@mail.com',
      countryId: 2,
      state: 'a state',
      town: 'a town',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString(),
      holydayDate: new Date().toISOString(),
      totalArea: 200,
      totalPopulation: 5122,
    },
  ]);

  await knex('Sites').insert([
    {
      id: 640,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 310,
    },
  ]);

  await knex('UtilityEmissions').insert([
    {
      id: 10,
      year: 2010,
      emissionFactor: 'special',
      value: 200,
      fuelSourceId: 1,
      siteId: 640,
    },
    {
      id: 12,
      year: 2010,
      emissionFactor: 'special',
      value: 200,
      fuelSourceId: 1,
      siteId: 640,
    },
  ]);

  await knex('UtilityConsumptions').insert([
    {
      id: 10,
      date: '2001-01-01',
      consumption: 100,
      cost: 100,
      fuelSourceId: 1,
      siteId: 640,
    },
    {
      id: 12,
      date: '2001-02-01',
      consumption: 100,
      cost: 100,
      fuelSourceId: 1,
      siteId: 640,
    },
  ]);
}
