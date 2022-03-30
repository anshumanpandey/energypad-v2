import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  const fuel1 = { id: 1, source: 'Grid Electricity' };
  await knex('FuelSources').insert([
    fuel1,
    { id: 2, source: 'Gas' },
    { id: 3, source: 'Solar PV' },
    { id: 4, source: 'Petrol' },
    { id: 5, source: 'Diesel' },
    { id: 6, source: 'Bio Diesel' },
  ]);
  await knex('FuelUses').insert([
    { id: 105, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);

  await knex('Businesses').insert([
    {
      id: 148,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail482@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'a town',
      postCode: '485 s8d',
      subscriptionDate: new Date().toISOString().split('T')[0],
      holydayDate: new Date().toISOString().split('T')[0],
      totalArea: 200,
      totalPopulation: 5122,
    },
  ]);

  await knex('Sites').insert([
    {
      id: 101,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 148,
    },
  ]);
}
