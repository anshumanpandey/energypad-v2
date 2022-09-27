import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser, registerUser } from './testhelp';
import schema from '../src/types/Schema.json';

describe('/Utility ', () => {
  test('It should respond with success when adding a consuption to a utility', async () => {
    const body = await loginUser('mail198@mail.com');

    const response = await supertest(app)
      .post('/api/utility/addConsumption')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          date: '2010-01-01',
          consumption: 100,
          cost: 100,
          conversionUnit: 'L',
          siteId: 89,
          fuelSourceId: 1,
        },
        {
          date: '2010-02-01',
          consumption: 100,
          cost: 100,
          conversionUnit: 'm3',
          siteId: 89,
          fuelSourceId: 1,
        },
      ]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.AddFuelSourceConsumption.content['application/json'].schema,
    );

    const user2 = await loginUser('mail198@mail.com');
    const consumptions = await supertest(app)
      .get('/api/utility/consumptions')
      .set('Authorization', `Bearer ${user2.jwt}`);
    expect(consumptions.body.length).toBe(2);
  });

  test('It should respond with success message when importing utilities from file', async () => {
    const body = await loginUser('mail212@mail.com');

    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Gas',
    });

    const response = await supertest(app)
      .post('/api/utility/importUtility')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('fuelSource', '1')
      .attach('excel', 'test/fixtures/utility_sample_good.xlsx');
    expect(response.body).toMatchSchema(
      schema.components.responses.UtilityFileImport.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when importing logs from file', async () => {
    const body = await loginUser('mail212@mail.com');

    const response = await supertest(app)
      .post('/api/utility/importLogs')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/fixtures/log_sample_good.xlsx');
    expect(response.body).toMatchSchema(
      schema.components.responses.UtilityFileImport.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with saving tips succesfully', async () => {
    const body = await registerUser();
    const response = await supertest(app).get('/api/utility/savingTips').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toBe(1);
    expect(typeof response.body[0].category).toBe('string');
    expect(typeof response.body[0].text).toBe('string');
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success when saving energy emission', async () => {
    const body = await loginUser('mail224@mail.com');
    const response = await supertest(app)
      .post('/api/utility/addEmission')
      .send([
        {
          value: 600,
          year: 2001,
          siteId: 452,
          fuelSourceId: 1,
        },
        {
          value: 200,
          year: 2003,
          siteId: 452,
          fuelSourceId: 1,
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);

    const response2 = await supertest(app)
      .post('/api/utility/addEmission')
      .send([
        {
          value: 600,
          year: 2003,
          siteId: 452,
          fuelSourceId: 1,
        },
        {
          value: 600,
          year: 2002,
          siteId: 452,
          fuelSourceId: 1,
        },
      ])
      .set('Authorization', `Bearer ${body.jwt}`);
    expect(response2.statusCode).toBe(200);
  });

  test('It should respond with fuel sources', async () => {
    const body = await registerUser();
    const response = await supertest(app).get('/api/utility/fuelSources').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(6);
  });

  test('It should respond with business emissions', async () => {
    const body = await loginUser('mail310@mail.com');
    const response = await supertest(app).get('/api/utility/emissions').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
  });

  test('It should respond with business consumption', async () => {
    const body = await loginUser('mail310@mail.com');
    const response = await supertest(app).get('/api/utility/consumptions').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
  });
});
