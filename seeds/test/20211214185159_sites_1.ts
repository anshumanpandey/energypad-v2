import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 236,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail236@mail.com',
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
      id: 238,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail238@mail.com',
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
  ]);

  await knex('Sites').insert([
    {
      id: 466,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 236,
    },
    {
      id: 468,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 236,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 204,
      name: 'Heat204',
      businessId: 236,
    },
  ]);
}
