import supertest from 'supertest';
import { app } from '../src/app';
import { loginUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';

expect.extend(matcher);

describe('/Dashboard ', () => {
  test('It should respond with success message when create an utility', async () => {
    const body = await loginUser('userdashboard302@mail.com');
    const response = await supertest(app).get('/api/dashboard').set('Authorization', `Bearer ${body.jwt}`);

    expect(response.body).toMatchSchema(
      schema.components.responses.GetDashboardData.content['application/json'].schema,
    );

    const currentYear = new Date().getFullYear();
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].date).toBe(currentYear + '-01-01');
    expect(response.body[0].averageCost).toBe(150);
    expect(response.body[0].averageConsumption).toBe(125);
    expect(response.body[0].consumption).toBe(150);

    expect(response.body[1].date).toBe(currentYear + '-02-01');
    expect(response.body[1].averageCost).toBe(200);
    expect(response.body[1].averageConsumption).toBe(150);
    expect(response.body[1].consumption).toBe(150);
  });
});
