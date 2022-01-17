import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Inserts seed entries
  const record = await knex('FuelSources').insert([{ id: 1, source: 'Electricity' }]);
  await knex('FuelUses').insert([
    { id: 105, use: 'Cooling' },
    { id: 2, use: 'Heating' },
    { id: 3, use: 'Lighting' },
    { id: 4, use: 'Powering' },
  ]);

  await knex('UsedInToFuelSource').insert([
    { id: 11, usedInId: 105, fuelSourceId: record[0] },
    { id: 22, usedInId: 2, fuelSourceId: record[0] },
    { id: 33, usedInId: 3, fuelSourceId: record[0] },
    { id: 44, usedInId: 4, fuelSourceId: record[0] },
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
      country: 'UK',
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
