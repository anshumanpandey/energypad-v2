import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import DB from '../src/lib/db/Db';
import schema from '../src/types/Schema.json';

beforeAll(async () => {
  await DB.migrate.latest();
});

afterAll(async () => {
  await DB.schema.dropTable('Users');
  await DB.migrate.rollback(undefined, true);
});

describe('GET / ', () => {
  test('It should respond with success message', async () => {
    const response = await supertest(app).post('/api/auth').send({
      address: 'Aca limited',
      email: 'aca@mail.com',
      password: '123456Abc!',
      sites: 'somewhere',
      bussinesName: 'ACA Limited',
      propertyName: 'Corporate',
      postCode: 'BR1 AD2',
      town: 'London',
      population: 1000,
      size: 200,
      fuel: 'Electricity',
      uses: 'Heating',
    });
    expect(response.body).toMatchSchema(schema.components.responses.Register.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with fail with wrong parameters', async () => {
    const response = await supertest(app).post('/api/auth').send({
      address: 'Aca limited',
      email: 'aca@mail.com',
      password: '123456Abc!',
      sites: 'somewhere',
      bussinesName: 'ACA Limited',
      propertyName: 'Corporate',
      postCode: 'BR1 AD2',
      town: 'London',
      population: '1000',
      size: '200',
      fuel: 'Electricity',
      uses: 'Heating',
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.statusCode).toBe(400);
  });
});
