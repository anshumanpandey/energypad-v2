import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 312,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail312@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString().split('T')[0],
      holydayDate: new Date().toISOString().split('T')[0],
      totalArea: 200,
      totalPopulation: 5122,
      workingHoursStart: 1,
      workingHoursEnd: 1,
    },
    {
      id: 316,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail316@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString(),
      holydayDate: new Date().toISOString(),
      totalArea: 200,
      totalPopulation: 5122,
      workingHoursStart: 1,
      workingHoursEnd: 1,
    },
  ]);

  await knex('Sites').insert([
    {
      id: 474,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 312,
    },
    {
      id: 478,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 316,
    },
    {
      id: 480,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 312,
    },
  ]);

  await knex('BusinessFuelsSize').insert([
    {
      id: 200,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 2,
    },

    {
      id: 202,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 480,
      usedInId: 3,
    },
  ]);
}
