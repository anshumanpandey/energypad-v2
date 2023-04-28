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
      .attach('excel', 'test/fixtures/business_patterns.xlsx');
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
          fuelSourceId: 1,
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
          fuelSourceId: 1,
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
          fuelSourceId: 1,
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
          fuelSourceId: 1,
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
      .get('/api/utility/monitoring?siteId=602&month=1&year=2020')
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
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
});
