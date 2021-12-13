import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser, NO_EXTRA_PROPERTY_ERROR_MESSAGE, registerUser } from './testhelp';
import schema from '../src/types/Schema.json';

describe('/Utility ', () => {
  test('It should respond with success message when create an utility', async () => {
    const body = await registerUser();
    const response = await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Gas',
    });
    expect(response.body).toMatchSchema(schema.components.responses.CreateUtility.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with error message when sending wrong params', async () => {
    const body = await registerUser();
    const response = await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'in amet enim',
      another: 1,
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.body.message).toBe(NO_EXTRA_PROPERTY_ERROR_MESSAGE);
    expect(response.statusCode).toBe(400);
  });

  test('It should respond with success when adding a consuption to a utility', async () => {
    const body = await loginUser('mail198@mail.com');

    const response = await supertest(app)
      .post('/api/utility/addEmission/498')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send({
        date: '2020-01-01',
        consumption: 100,
        cost: 100,
        siteId: 441,
        usedInId: 2,
      });
    expect(response.body).toMatchSchema(
      schema.components.responses.AddUtilityConsumption.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when importing from file', async () => {
    const body = await loginUser('mail212@mail.com');

    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Gas',
    });

    const response = await supertest(app)
      .post('/api/utility/importUtility')
      .set('Authorization', `Bearer ${body.jwt}`)
      .field('utilityId', '124')
      .attach('excel', 'test/fixtures/sample_good.xlsx');
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
    expect(response.body[0].imageUrl).toBe(null);
    expect(response.statusCode).toBe(200);
  });
});
