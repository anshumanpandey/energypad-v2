import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import schema from '../src/types/Schema.json';

describe('GET / ', () => {
  test('It should respond with success message', async () => {
    const response = await supertest(app).post('/api/user/address').send({
      name: 'New Student',
    });
    expect(response.body).toMatchSchema(schema.components.responses.CreateUser.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });
});
