import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 232,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123458Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail232@mail.com',
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
      id: 460,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      workinghours: 2,
      size: 15,
      businessId: 232,
    },
    {
      id: 462,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      workinghours: 2,
      size: 15,
      businessId: 232,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 200,
      name: 'Heat200',
      businessId: 232,
    },
  ]);

  await knex('Businesses').insert([
    {
      id: 234,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123458Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail234@mail.com',
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
      id: 464,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      workinghours: 2,
      size: 15,
      businessId: 234,
    },
  ]);
  await knex('Utilities').insert([
    {
      id: 202,
      name: 'Heat202',
      businessId: 234,
    },
  ]);
}
