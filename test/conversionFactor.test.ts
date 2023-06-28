import supertest from 'supertest';
import { app } from '../src/app';
import { loginUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';

expect.extend(matcher);

describe('/ConversionFactor', () => {
  test('It should respond with conversion values', async () => {
    const body = await loginUser(app)('mail238@mail.com');
    const response = await supertest(app)
      .get('/api/conversionUnit?fuelSource=L')
      .set('Authorization', `Bearer ${body.jwt}`);

    expect(response.body).toMatchSchema(
      schema.components.responses.GetConversionUnit.content['application/json'].schema,
    );
    expect(response.body.length).toBe(1);
    expect(response.statusCode).toBe(200);

    const response2 = await supertest(app)
      .get('/api/conversionUnit?fuelSource=L,m3')
      .set('Authorization', `Bearer ${body.jwt}`);

    expect(response2.body).toMatchSchema(
      schema.components.responses.GetConversionUnit.content['application/json'].schema,
    );
    expect(response2.body.length).toBe(1);
    expect(response2.statusCode).toBe(200);
  });
});
