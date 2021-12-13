import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser, registerUser } from './testhelp';
import schema from '../src/types/Schema.json';

describe('/Business ', () => {
  test('It should respond with success message when updating an user', async () => {
    const body = await registerUser();
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
      patterns: [
        {
          startDate: '2020-01-01',
          endDate: '2020-03-02',
          consumption: 200,
          daysOnYear: 50,
          usedInId: 2,
          siteId: 353,
        },
        {
          startDate: '2020-05-05',
          endDate: '2020-06-05',
          consumption: 300,
          daysOnYear: 20,
          usedInId: 3,
          siteId: 353,
        },
      ],
    };
    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
  });

  test('It should respond with success message when updating an user with programmes', async () => {
    const body = await loginUser('mail218@mail.com');
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
      programmes: [
        { question: 'How often?', answers: ['Montly', 'Yearly'], utilityId: 184 },
        { question: 'What type?', answers: ['Single', 'Triple'], utilityId: 184 },
      ],
    };
    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);

    const newData2 = newData;
    newData2.programmes[0].answers.push('Daily');
    const response2 = await supertest(app)
      .put('/api/business')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData2);

    expect(response2.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const meData = await supertest(app).get('/api/business').set('Authorization', `Bearer ${body.jwt}`);
    expect(meData.body.programmes.length).toBe(2);
    expect(meData.body.programmes[0].answers.length).toBe(3);
  });

  test('It should respond with success message when saving energy', async () => {
    const body = await loginUser('mail482@mail.com');
    const newData = {
      usedInId: 105,
      siteId: 101,
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
      distance: [
        {
          meters: '54984315135',
        },
        {
          meters: '445ads654sd',
        },
      ],
      cost: {
        currencyCode: 'GBP',
        vat: 200,
      },
    };
    const response = await supertest(app)
      .post('/api/business/saveEnergy')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);

    const newData2 = newData;
    newData2.brands[0].days.push('Wed');
    const response2 = await supertest(app)
      .post('/api/business/saveEnergy')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData2);

    expect(response2.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const meData = await supertest(app).get('/api/business/energies').set('Authorization', `Bearer ${body.jwt}`);
    expect(meData.statusCode).toBe(200);
    expect(meData.body[0].brands.length).toBe(2);
    expect(meData.body[0].distance.length).toBe(2);
    expect(meData.body[0].brands[0].days.length).toBe(3);
  });

  test('It should respond with success message when saving a log', async () => {
    const body = await loginUser('mail226@mail.com');
    const newData = {
      usedInId: 2,
      siteId: 454,
      operation: 'an opetation',
      comments: 'some comments',
      startDate: '2020-10-01',
      endDate: '2020-10-08',
    };
    const response = await supertest(app)
      .post('/api/business/addLog')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.AddLog.content['application/json'].schema);
  });
});
