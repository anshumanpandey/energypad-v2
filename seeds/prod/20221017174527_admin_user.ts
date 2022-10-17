import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses')
    .insert([
      {
        id: 1,
        businessName: 'Energypad',
        businessType: 'a type',
        businessService: 'a service',
        password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
        siteName: 'a site',
        buildingName: 'a name',
        contactName: 'a contact name',
        position: 'a position',
        phoneNumber: '+55 122334444',
        email: 'admin@energypad.com',
        countryId: 2,
        stateId: 42,
        town: 'a town',
        currencyCode: 'USD',
        postCode: '485 s8d',
        subscriptionDate: new Date().toISOString().split('T')[0],
      },
    ])
    .onConflict('id')
    .ignore();
}
