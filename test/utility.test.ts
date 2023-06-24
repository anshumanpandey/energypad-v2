import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser, registerUser } from './testhelp';
import schema from '../src/types/Schema.json';

describe('/Utility ', () => {
  test('It should respond with success when adding a consuption to a utility', async () => {
    const body = await loginUser(app)('mail198@mail.com');

    const response = await supertest(app)
      .post('/api/utility/addConsumption')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          date: '2010-01-01',
          consumption: 100,
          totalCost: 100,
          vat: 2,
          conversionFactor: 20,
          fuelUnit: 'L',
          siteId: 89,
          fuelSourceId: 1,
          usedInId: [3],
        },
        {
          date: '2010-02-01',
          consumption: 100,
          totalCost: 100,
          vat: 2,
          conversionFactor: 20,
          fuelUnit: 'm3',
          siteId: 89,
          fuelSourceId: 1,
          usedInId: [2],
        },
      ]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.AddFuelSourceConsumption.content['application/json'].schema,
    );

    const user2 = await loginUser(app)('mail198@mail.com');
    const consumptions = await supertest(app)
      .get('/api/utility/consumptions')
      .set('Authorization', `Bearer ${user2.jwt}`);
    expect(consumptions.body.length).toBe(2);
    const first = consumptions.body.find((i: any) => i.date === '2010-01-01');
    expect(first.consumption).toBe(100);
    const second = consumptions.body.find((i: any) => i.date === '2010-02-01');
    expect(second.consumption).toBe(100);
  });

  test('It should respond with success for a site with defined conversion units', async () => {
    const body = await loginUser(app)('mail402@mail.com');

    const response = await supertest(app)
      .post('/api/utility/addConsumption')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          date: '2010-01-01',
          consumption: 17742.166,
          totalCost: 100,
          vat: 2,
          conversionFactor: 20,
          fuelUnit: 'm3',
          siteId: 552,
          fuelSourceId: 1,
          usedInId: [3],
        },
        {
          date: '2010-02-01',
          consumption: 118.08,
          totalCost: 100,
          vat: 2,
          conversionFactor: 20,
          fuelUnit: 'm3',
          siteId: 552,
          fuelSourceId: 1,
          usedInId: [3],
        },
      ]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.AddFuelSourceConsumption.content['application/json'].schema,
    );

    const user2 = await loginUser(app)('mail402@mail.com');
    const consumptions = await supertest(app)
      .get('/api/utility/consumptions')
      .set('Authorization', `Bearer ${user2.jwt}`);
    expect(consumptions.body.length).toBe(2);
    const first = consumptions.body.find((i: any) => i.date === '2010-01-01');
    expect(first.consumption).toBe(17742.166);
    const second = consumptions.body.find((i: any) => i.date === '2010-02-01');
    expect(second.consumption).toBe(118.08);
  });

  test('It should respond with success message when importing utilities from file', async () => {
    const body = await loginUser(app)('mail212@mail.com');

    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Gas',
    });

    const response = await supertest(app)
      .post('/api/utility/importUtility')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fuelSource', '1')
      .attach('excel', 'test/fixtures/utility_sample_good.xlsx');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.UtilityFileImport.content['application/json'].schema,
    );
  });

  test('It should respond with success message when importing logs from file', async () => {
    const body = await loginUser(app)('mail212@mail.com');

    const response = await supertest(app)
      .post('/api/utility/importLogs')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/fixtures/log_sample_good.xlsx');
    expect(response.body).toMatchSchema(
      schema.components.responses.UtilityFileImport.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when importing patterns from file', async () => {
    const body = await loginUser(app)('mail230@mail.com');

    const response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/fixtures/business_patterns (1).xlsx');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.FileImportBusinessPatterns.content['application/json'].schema,
    );
  });

  test('It should respond with success message when importing tenants from file', async () => {
    const body = await loginUser(app)('mail228@mail.com');

    const response = await supertest(app)
      .post('/api/business/importTenants')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/fixtures/business_tenant.xlsx');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.FileImportBusiness.content['application/json'].schema,
    );
  });

  test('It should respond with saving tips succesfully', async () => {
    const body = await registerUser(app)();
    const response = await supertest(app).get('/api/utility/savingTips').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toBe(1);
    expect(typeof response.body[0].category).toBe('string');
    expect(typeof response.body[0].text).toBe('string');
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success when saving energy emission', async () => {
    const body = await loginUser(app)('mail224@mail.com');
    const response = await supertest(app)
      .post('/api/utility/addEmission')
      .send([
        {
          emissionFactor: 15,
          conversionFactor: 34,
          fuelUnit: 'm3',
          date: '2001-01-01',

          siteId: 452,
          fuelSourceId: 1,
          usedInId: [2],
        },
        {
          emissionFactor: 8,
          conversionFactor: 22,
          fuelUnit: 'm3',
          date: '2001-01-01',

          siteId: 452,
          fuelSourceId: 2,
          usedInId: [2],
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response.body).toMatchSchema(
      schema.components.responses.AddFuelSourceEmission.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);

    const response2 = await supertest(app)
      .post('/api/utility/addEmission')
      .send([
        {
          emissionFactor: 18,
          conversionFactor: 52,
          fuelUnit: 'm3',
          date: '2003-05-01',

          siteId: 452,
          fuelSourceId: 1,
          usedInId: [2],
        },
        {
          emissionFactor: 4,
          conversionFactor: 37,
          fuelUnit: 'm3',
          date: '2002-07-01',

          siteId: 452,
          fuelSourceId: 2,
          usedInId: [2],
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response2.statusCode).toBe(200);
  });

  test('It should respond with success when saving energy monitoring', async () => {
    const body = await loginUser(app)('mail610@mail.com');
    const response = await supertest(app)
      .post('/api/utility/addMonitoring')
      .send([
        {
          carbon: 12,
          energy: 22,
          conversionFactor: 34,
          fuelUnit: 'm3',
          date: '2001-01-01',

          siteId: 602,
          fuelSourceId: 1,
          usedInId: [2],
        },
        {
          carbon: 8,
          energy: 18,
          conversionFactor: 22,
          fuelUnit: 'L',
          date: '2001-01-01',

          siteId: 602,
          fuelSourceId: 2,
          usedInId: [2, 3],
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.AddFuelSourceMonitoring.content['application/json'].schema,
    );

    const response2 = await supertest(app)
      .post('/api/utility/addMonitoring')
      .send([
        {
          carbon: 18,
          energy: 28,
          conversionFactor: 52,
          fuelUnit: 'm3',
          date: '2003-05-01',

          siteId: 602,
          fuelSourceId: 1,
          usedInId: [2],
        },
        {
          carbon: 4,
          energy: 44,
          conversionFactor: 37,
          fuelUnit: 'm3',
          date: '2002-07-01',

          siteId: 602,
          fuelSourceId: 3,
          usedInId: [2],
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response2.statusCode).toBe(200);
  });

  test('It should respond with fuel sources', async () => {
    const body = await registerUser(app)();
    const response = await supertest(app).get('/api/utility/fuelSources').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(6);
  });

  test('It should respond with monitoring', async () => {
    const body = await loginUser(app)('mail610@mail.com');
    const response = await supertest(app)
      .get('/api/utility/monitoring?siteId=602&month=0&year=2020')
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].carbon).toBe(22);
  });

  test('It should respond with business emissions', async () => {
    const body = await loginUser(app)('mail310@mail.com');
    const response = await supertest(app).get('/api/utility/emissions').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    const response2 = await supertest(app)
      .get('/api/utility/emissions?siteId=640&year=2019')
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response2.statusCode).toBe(200);
    expect(response2.body.length).toBe(1);
  });

  test('It should respond with business consumption', async () => {
    const body = await loginUser(app)('mail310@mail.com');
    const response = await supertest(app).get('/api/utility/consumptions').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
  });

  test('It should respond with success message when importing utilities cost from file', async () => {
    const body = await loginUser(app)('mail614@mail.com');

    const response2 = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'cost')
      .attach('excel', 'test/fixtures/Consumption.xlsx');
    expect(response2.statusCode).toBe(200);
  });

  /*test('It should respond with success message when importing utilities consumption from file', async () => {
    const body = await loginUser(app)('mail614@mail.com');

    const response2 = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'consumption')
      .field('fuels', [2, 3])
      .attach('excel', 'test/fixtures/historic_data-consumption.xlsx');
    expect(response2.statusCode).toBe(200);
  });*/

  test('It should respond with success message when importing utilities cost then consumption from file', async () => {
    const user = await loginUser(app)('mail614@mail.com');

    const response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${user.jwt}`)
      .field('fileType', 'consumptions')
      .field('fuels', [2, 3])
      .attach('excel', 'test/fixtures/Consumption.xlsx');
    expect(response.statusCode).toBe(200);

    const consumptions = await supertest(app)
      .get('/api/utility/consumptions')
      .set('Authorization', `Bearer ${user.jwt}`);
    expect(consumptions.body.length).toBe(14);
    const one = consumptions.body.find((i: any) => i.date === '2023-01-01' && i.siteId === 604 && i.fuelSourceId === 2);
    expect(one.consumption).toBe(200);
    expect(one.vat).toBe(0);
    expect(one.totalCost).toBe(400);
    const two = consumptions.body.find((i: any) => i.date === '2023-02-01' && i.siteId === 604 && i.fuelSourceId === 1);
    expect(two.consumption).toBe(120);
    expect(two.vat).toBe(0);
    expect(two.totalCost).toBe(300);

    const response2 = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${user.jwt}`)
      .field('fileType', 'cost')
      .attach('excel', 'test/fixtures/Consumption.xlsx');
    expect(response2.statusCode).toBe(200);

    const consumptions2 = await supertest(app)
      .get('/api/utility/consumptions')
      .set('Authorization', `Bearer ${user.jwt}`);
    expect(consumptions2.body.length).toBe(14);
    const three = consumptions2.body.find(
      (i: any) => i.date === '2023-01-01' && i.siteId === 604 && i.fuelSourceId === 2,
    );
    expect(three.consumption).toBe(200);
    expect(three.vat).toBe(0);
    expect(three.totalCost).toBe(400);
    const four = consumptions2.body.find(
      (i: any) => i.date === '2023-02-01' && i.siteId === 604 && i.fuelSourceId === 1,
    );
    expect(four.consumption).toBe(120);
    expect(four.vat).toBe(0);
    expect(four.totalCost).toBe(300);
  });

  /*test('It should respond with success message when importing utilities consumption then cost from file', async () => {
    const body = await loginUser(app)('mail614@mail.com');

    await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'cost')
      .attach('excel', 'test/fixtures/historic_data-cost.xlsx');

    const response2 = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'consumptions')
      .field('fuels', [2, 3])
      .attach('excel', 'test/fixtures/historic_data-consumption.xlsx');
    expect(response2.statusCode).toBe(200);
  });

  test('It should respond with success message when importing utilities emission from file', async () => {
    const body = await loginUser(app)('mail614@mail.com');

    const response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'emissions')
      .attach('excel', 'test/fixtures/historic_data-emissions.xlsx');
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with faile when importing from file with a site that does not exist', async () => {
    const body = await loginUser(app)('mail614@mail.com');

    const response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fileType', 'consumptions')
      .attach('excel', 'test/fixtures/historic_data-consumption-bad_site.xlsx');
    expect(response.statusCode).toBe(400);
  });*/
});
