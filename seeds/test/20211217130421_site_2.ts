import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 240,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail240@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      currencyCode: 'USD',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 242,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail242@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      currencyCode: 'USD',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString().split('T')[0],
    },
  ]);

  await knex('Sites').insert([
    {
      id: 470,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 240,
    },
    {
      id: 472,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 240,
    },
  ]);

  await knex('Floors').insert([
    {
      id: 10,
      size: 'some',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
    {
      id: 12,
      size: 'some2',
      area: 20000,
      population: 20000,
      businessId: 242,
    },
  ]);
}
