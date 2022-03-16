import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    {
      id: 314,
      businessName: 'long name',
      businessType: 'a type',
      businessService: 'a service',
      password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
      siteName: 'a site',
      buildingName: 'a name',
      contactName: 'a contact name',
      position: 'a position',
      phoneNumber: '+55 122334444',
      email: 'mail314@mail.com',
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
      id: 476,
      type: 'some',
      address: 'anywhere',
      postCode: '484 sd8',
      town: 'some town',
      population: 15000,
      size: 15,
      businessId: 314,
    },
  ]);

  await knex('Programmes').insert([
    {
      id: 100,
      question: 'How often?',
      siteId: 476,
      usedInId: 2,
    },
    {
      id: 102,
      question: 'What type?',
      siteId: 476,
      usedInId: 2,
    },
  ]);
  await knex('ProgrammeAnswers').insert([
    {
      id: 100,
      answer: 'Montly',
      programmeId: 100,
    },
    {
      id: 102,
      answer: 'Yearly',
      programmeId: 100,
    },
    {
      id: 104,
      answer: 'Triple',
      programmeId: 102,
    },
    {
      id: 106,
      answer: 'Single',
      programmeId: 102,
    },
  ]);

  await knex('Reviews').insert([
    {
      id: 100,
      question: 'How near?',
      siteId: 476,
    },
  ]);
  await knex('ReviewsAnswers').insert([
    {
      id: 100,
      answer: 'Montly',
      reviewId: 100,
    },
    {
      id: 102,
      answer: 'Quarterly',
      reviewId: 100,
    },
    {
      id: 104,
      answer: 'Bianually',
      reviewId: 100,
    },
  ]);

  await knex('BusinessTenant').insert([
    {
      id: 100,
      date: '2021-08-09',
      regularTenantAmount: 25,
      irregularTenantAmount: 25,
      siteId: 476,
      usedInId: 2,
    },
    {
      id: 102,
      date: '2020-08-01',
      regularTenantAmount: 25,
      irregularTenantAmount: 55,
      siteId: 476,
      usedInId: 3,
    },
  ]);

  await knex('BusinessLog').insert([
    {
      id: 100,
      startDate: '2020-10-01',
      endDate: '2020-10-08',
      comments: 'some long comment',
      operation: 'some operation',
      siteId: 476,
      usedInId: 2,
    },
  ]);

  await knex('BusinessFuelsPricing').insert([
    {
      id: 100,
      currencyCode: 'GBP',
      vat: 200,
      fuelSourceId: 1,
      usedInId: 2,
      siteId: 476,
    },

    {
      id: 102,
      currencyCode: 'GBP',
      vat: 200,
      fuelSourceId: 1,
      usedInId: 3,
      siteId: 476,
    },
  ]);

  await knex('BusinessFuelsSize').insert([
    {
      id: 100,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 476,
      usedInId: 2,
    },

    {
      id: 102,
      meters: 5498,
      fuelSourceId: 1,
      siteId: 476,
      usedInId: 3,
    },
  ]);

  await knex('BusinessBrands').insert([
    {
      id: 100,
      name: 'All Time',
      startTime: '00:00:00',
      endTime: '00:20:00',
      rate: 200,
      days: 'Mon,Tue',
      usedInId: 2,
      fuelSourceId: 1,
      siteId: 476,
    },
    {
      id: 102,
      name: 'Rate 1',
      startTime: '00:00:00',
      endTime: '00:12:00',
      rate: 200,
      days: 'Mon,Tue,Wed',
      fuelSourceId: 1,
      usedInId: 2,
      siteId: 476,
    },

    {
      id: 104,
      name: 'All Time',
      startTime: '00:00:00',
      endTime: '00:20:00',
      rate: 200,
      days: 'Mon,Tue',
      usedInId: 3,
      fuelSourceId: 1,
      siteId: 476,
    },
    {
      id: 106,
      name: 'Rate 1',
      startTime: '00:00:00',
      endTime: '00:12:00',
      rate: 200,
      days: 'Mon,Tue,Wed',
      fuelSourceId: 1,
      usedInId: 3,
      siteId: 476,
    },
  ]);

  await knex('UsedInToFuelSourceToSite').insert([
    {
      id: 1,
      siteId: 476,
      fuelSourceId: 1,
      usedInId: 3,
    },
  ]);
}
