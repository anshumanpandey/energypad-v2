import supertest from 'supertest';
import { app } from '../src/app';
import { loginUser, registerUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';

expect.extend(matcher);

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
      countryId: 5,
      stateId: 46,
      town: 'new_town',
      postCode: 'new_postCode',
      subscriptionDate: '2021-01-01',
      holydayDate: '2020-01-01',
      totalArea: 9,
      totalPopulation: 10,
    };

    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
  });

  test('It should respond with success message when updating an user without optional values', async () => {
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
      countryId: 5,
      stateId: 46,
      town: 'new_town',
      postCode: 'new_postCode',
      subscriptionDate: '2021-01-01',
      holydayDate: '2020-01-01',
    };

    const response = await supertest(app).put('/api/business').set('Authorization', `Bearer ${body.jwt}`).send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
  });

  test('It should respond with success message when saving energy', async () => {
    const body = await loginUser('mail482@mail.com');
    const newData = {
      siteId: 101,
      records: [
        {
          fuelSourceId: 1,
          usedInId: [2, 3, 4],
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
          meternumbers: [
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
        },
      ],
    };
    const response = await supertest(app)
      .post('/api/business/saveEnergy')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.body).toMatchSchema(
      schema.components.responses.SaveBusinessEnergy.content['application/json'].schema,
    );
    expect(response.statusCode).toBe(200);

    const newData2 = newData;
    newData2.records[0].brands[0].days.push('Wed');
    newData2.records[0].usedInId.pop();
    const response2 = await supertest(app)
      .post('/api/business/saveEnergy')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData2);

    expect(response2.body).toMatchSchema(schema.components.responses.UpdateUser.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const meData = await supertest(app).get('/api/business/energies').set('Authorization', `Bearer ${body.jwt}`);
    expect(meData.statusCode).toBe(200);
    expect(meData.body.length).toBe(1);
    expect(meData.body[0].brands.length).toBe(2);
    expect(meData.body[0].meternumbers.length).toBe(2);
    expect(meData.body[0].brands[0].days.length).toBe(3);
    expect(meData.body[0].usedInId.length).toBe(2);
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

  test('It should respond with success message when saving tenants', async () => {
    const body = await loginUser('mail226@mail.com');
    const newData = [
      {
        siteId: 454,
        usedInId: 2,
        date: '2021-08-01',
        regularTenantAmount: 25,
        irregularTenantAmount: 50,
      },
      { siteId: 454, usedInId: 3, date: '2021-08-09', regularTenantAmount: 25, irregularTenantAmount: 55 },
    ];
    const response = await supertest(app)
      .post('/api/business/setTenants')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);

    const response2 = await supertest(app)
      .post('/api/business/setTenants')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          ...newData[0],
          date: '2020-08-01',
        },
      ]);
    expect(response2.statusCode).toBe(200);
    expect(response2.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);
  });

  test('It should respond with success message when saving reviews', async () => {
    const body = await loginUser('mail232@mail.com');
    const newData = [
      {
        siteId: 460,
        question: 'How often?',
        answers: ['montly', 'Quarterly', 'Bianually'],
      },
      {
        siteId: 460,
        question: 'How near?',
        answers: ['montly', 'Quarterly', 'Bianually'],
      },
    ];
    const response = await supertest(app)
      .post('/api/business/setReviews')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);

    const response2 = await supertest(app)
      .post('/api/business/setReviews')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          siteId: 460,
          question: 'How near?',
          answers: ['Montly', 'Quarterly', 'Bianually'],
        },
      ]);
    expect(response2.statusCode).toBe(200);
    expect(response2.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);
  });

  test('It should respond with success message when saving programmes', async () => {
    const body = await loginUser('mail234@mail.com');
    const newData = [
      { question: 'How often?', answers: ['Montly', 'Yearly'], siteId: 464, usedInId: 2 },
      { question: 'What type?', answers: ['Single', 'Triple'], siteId: 464, usedInId: 2 },
    ];
    const response = await supertest(app)
      .post('/api/business/setProgrammes')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);
  });

  test('It should respond with correct sites for user', async () => {
    const body = await loginUser('mail236@mail.com');
    const response = await supertest(app).get('/api/business/sites').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].id).toBe(466);
    expect(response.body[1].id).toBe(468);

    const body2 = await loginUser('mail240@mail.com');
    const response2 = await supertest(app).get('/api/business/sites').set('Authorization', `Bearer ${body2.jwt}`);
    expect(response2.statusCode).toBe(200);
    expect(response2.body.length).toBe(2);
    expect(response2.body[0].id).toBe(470);
    expect(response2.body[1].id).toBe(472);
  });

  test('It should respond with success message when saving floors', async () => {
    const body = await registerUser();
    const newData = [
      {
        size: 'floor_1',
        area: 200,
        population: 100,
      },
      {
        size: 'floor_2',
        area: 300,
        population: 200,
      },
    ];
    const response = await supertest(app)
      .post('/api/business/setFloors')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(newData);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);

    const response2 = await supertest(app)
      .post('/api/business/setFloors')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          size: 'floor_3',
          area: 300,
          population: 200,
        },
      ]);
    expect(response2.statusCode).toBe(200);
    expect(response2.body).toMatchSchema(schema.components.responses.SetTenants.content['application/json'].schema);
  });

  test('It should respond with correct floors for user', async () => {
    const body = await loginUser('mail242@mail.com');
    const response = await supertest(app).get('/api/business/foors').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].id).toBe(10);
    expect(response.body[1].id).toBe(12);
  });

  test('It should save patterns successfully', async () => {
    const body = await loginUser('mail434@mail.com');
    const response = await supertest(app)
      .post('/api/business/savePattern')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        {
          startDate: '2020-08-01',
          endDate: '2020-09-01',
          consumption: 20,
          daysOnYear: 20,
          siteId: 353,
          usedInId: 2,
        },
      ]);
    expect(response.statusCode).toBe(200);
  });

  test('It should get user data successfully', async () => {
    const body = await registerUser();
    const response = await supertest(app).get('/api/business').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
  });
});
