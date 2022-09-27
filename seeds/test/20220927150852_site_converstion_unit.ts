import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 400,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail400@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      currencyCode: 'USD',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 402,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail402@mail.com',
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
      id: 550,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 400,
    },
    {
      id: 552,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      fullTimeEmployee: false,
      workinghours: 2,
      size: 15,
      businessId: 402,
    },
  ]);

  await knex('SiteConversionUnits').insert([
    {
      unitType: 'L',
      unitValue: 23.77,
      siteId: 552,
    },
    {
      unitType: 'm3',
      unitValue: 0.48,
      siteId: 552,
    },
  ]);
}
