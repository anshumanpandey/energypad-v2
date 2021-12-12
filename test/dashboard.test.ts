import supertest from 'supertest';
import { int32Format } from '../src/middleware/requestValidator.middleware';
import { matchersWithOptions } from 'jest-json-schema';
const matcher = matchersWithOptions({
  formats: {
    int32: int32Format,
  },
});
expect.extend(matcher);
import { app } from '../src/app';
import { loginUser } from './testhelp';
import schema from '../src/types/Schema.json';
import DB from '../src/lib/db/Db';

beforeAll(async () => {
  await DB.migrate.latest().then(function () {
    return DB.seed.run();
  });
});

describe('/Dashboard ', () => {
  test('It should respond with success message when create an utility', async () => {
    const body = await loginUser('userdashboard1@mail.com');
    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Heat',
    });

    const utilitiesResponse = await supertest(app).get('/api/utility').set('Authorization', `Bearer ${body.jwt}`);
    const utility = utilitiesResponse.body[0];

    await supertest(app)
      .post('/api/utility/addEmission/' + utility.id)
      .set('Authorization', `Bearer ${body.jwt}`)
      .send({
        date: '2020-01-01',
        consumption: 100,
        cost: 100,
      });
    await supertest(app)
      .post('/api/utility/addEmission/' + utility.id)
      .set('Authorization', `Bearer ${body.jwt}`)
      .send({
        date: '2019-01-01',
        consumption: 150,
        cost: 200,
      });
    await supertest(app)
      .post('/api/utility/addEmission/' + utility.id)
      .set('Authorization', `Bearer ${body.jwt}`)
      .send({
        date: '2019-02-01',
        consumption: 150,
        cost: 200,
      });

    const response = await supertest(app).get('/api/dashboard').set('Authorization', `Bearer ${body.jwt}`);

    expect(response.body).toMatchSchema(
      schema.components.responses.GetDashboardData.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].date).toBe('2021-01-01');
    expect(response.body[0].averageCost).toBe(150);
    expect(response.body[0].averageConsumption).toBe(125);
    expect(response.body[0].consumption).toBe(100);

    expect(response.body[1].date).toBe('2021-02-01');
    expect(response.body[1].averageCost).toBe(200);
    expect(response.body[1].averageConsumption).toBe(150);
    expect(response.body[1].consumption).toBe(150);
  });
});
