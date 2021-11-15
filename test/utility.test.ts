import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser } from './testhelp';
import schema from '../src/types/Schema.json';
import DB from '../src/lib/db/Db';

beforeAll(async () => {
  await DB.migrate.latest();
});

describe('/Utility ', () => {
  test('It should respond with success message when create an utility', async () => {
    const body = await loginUser();
    const response = await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'in amet enim',
    });
    expect(response.body).toMatchSchema(schema.components.responses.CreateUtility.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with error message when sending wrong params', async () => {
    const body = await loginUser();
    const response = await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'in amet enim',
      another: 1,
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.statusCode).toBe(400);
  });

  test('It should respond with success when adding a consuption to a utility', async () => {
    const body = await loginUser();
    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'in amet enim',
    });

    const response = await supertest(app)
      .post('/api/utility/addEmission/1')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send({
        date: '2020-01-01',
        consumption: 100,
        cost: 100,
      });
    expect(response.body).toMatchSchema(
      schema.components.responses.AddUtilityEmission.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
  });
});
