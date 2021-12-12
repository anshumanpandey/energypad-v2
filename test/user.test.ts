import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser } from './testhelp';
import schema from '../src/types/Schema.json';
import DB from '../src/lib/db/Db';

beforeAll(async () => {
  await DB.migrate.latest().then(function () {
    return DB.seed.run();
  });
});

describe('/Business ', () => {
  test('It should respond with success message when updating an user', async () => {
    const body = await loginUser();
    const newData = {
      businessName: 'new_businessName',
      businessType: 'new_businessType',
      businessService: 'new_businessService',
      password: 'new_password',
      siteName: 'new_siteName',
      buildingName: 'new_buildingName',
      contactName: 'new_contactName',
      position: 'new_position',
      phoneNumber: 'new_phoneNumber',
      email: 'new_email',
      country: 'new_country',
      state: 'new_state',
      town: 'new_town',
      postCode: 'new_postCode',
      subscriptionDate: '2021-01-01',
      holydayDate: '2020-01-01',
      totalArea: 9,
      totalPopulation: 10,
      floors: [
        {
          size: 'NEW_floor_1',
          area: 200,
          population: 100,
        },
      ],
      cooling: {
        startDate: '2020-01-01',
        endDate: '2020-03-02',
        consumption: 200,
        daysOnYear: 50,
      },
      heating: {
        startDate: '2020-05-05',
        endDate: '2020-06-05',
        consumption: 300,
        daysOnYear: 20,
      },
    };
    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when updating an user with programmes', async () => {
    const body = await loginUser();
    const newData = {
      businessName: 'new_businessName',
      businessType: 'new_businessType',
      businessService: 'new_businessService',
      password: 'new_password',
      siteName: 'new_siteName',
      buildingName: 'new_buildingName',
      contactName: 'new_contactName',
      position: 'new_position',
      phoneNumber: 'new_phoneNumber',
      email: 'new_email',
      country: 'new_country',
      state: 'new_state',
      town: 'new_town',
      postCode: 'new_postCode',
      subscriptionDate: '2021-01-01',
      holydayDate: '2020-01-01',
      totalArea: 9,
      totalPopulation: 10,
      floors: [
        {
          size: 'NEW_floor_2',
          area: 200,
          population: 100,
        },
      ],
      cooling: {
        startDate: '2020-01-01',
        endDate: '2020-03-02',
        consumption: 200,
        daysOnYear: 50,
      },
      heating: {
        startDate: '2020-05-05',
        endDate: '2020-06-05',
        consumption: 300,
        daysOnYear: 20,
      },
      programmes: [
        { question: 'How often?', answers: ['Montly', 'Yearly'], utilityId: 1 },
        { question: 'What type?', answers: ['Single', 'Triple'], utilityId: 1 },
      ],
    };
    await supertest(app).post('/api/utility').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'Gas',
    });
    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response.statusCode).toBe(200);

    const newData2 = newData;
    newData2.programmes[0].answers.push('Daily');
    const response2 = await supertest(app)
      .put('/api/business')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData2);

    expect(response2.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const meData = await supertest(app).get('/api/business').set('Authorization', `Bearer ${body.jwt}`);
    expect(meData.body.programmes[0].answers.length).toBe(3);
  });

  test('It should respond with success message when updating an user with programmes', async () => {
    const body = await loginUser();
    const newData = {
      brands: [
        {
          name: 'All Time',
          startTime: '00:00:00',
          endTime: '00:20:00',
          days: ['Mon', 'Tue'],
          rate: 200,
        },
        {
          name: 'Rate 1',
          startTime: '00:00:00',
          endTime: '00:12:00',
          days: ['Mon', 'Tue'],
          rate: 300,
        },
      ],
    };
    const response = await supertest(app)
      .post('/api/business/setBrands')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);

    const newData2 = newData;
    newData2.brands[0].days.push('Wed');
    const response2 = await supertest(app)
      .post('/api/business/setBrands')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData2);

    expect(response2.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const meData = await supertest(app).get('/api/business').set('Authorization', `Bearer ${body.jwt}`);
    expect(meData.body.brands[0].days.length).toBe(3);
  });
});
