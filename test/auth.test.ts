import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
import { faker } from '@faker-js/faker';
expect.extend(matchers);
import { app } from '../src/app';
import schema from '../src/types/Schema.json';

describe('/auth', () => {
  test('It should respond with success message when register', async () => {
    const response = await supertest(app).post('/api/auth').send({
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail1a@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      postCode: 'velit id',
      address_1: 'address_1',
      subscriptionDate: '1989-07-20',
    });
    expect(response.body).toMatchSchema(schema.components.responses.Register.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when register with services', async () => {
    const response = await supertest(app).post('/api/auth').send({
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail1service1@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      postCode: 'velit id',
      address_1: 'address_1',
      subscriptionDate: '1989-07-20',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.Register.content['application/json'].schema);
  });

  test('It should respond with success message when register without passing optional values', async () => {
    const response = await supertest(app).post('/api/auth').send({
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail1x@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      postCode: 'velit id',
      address_1: 'address_1',
      subscriptionDate: '1989-07-20',
    });
    expect(response.body).toMatchSchema(schema.components.responses.Register.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  /*
    TODO: FIX when task on src/openApi/definitions/auth.register.definition.ts#L63 is resolvedtest('It should respond with error message when register when services has wrong data', async () => {
    const goodData = {
      businessName: 'proident nulla dolor',
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail1service2@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
    };
    const response1 = await supertest(app)
      .post('/api/auth')
      .send({
        ...goodData,
        totalxxxxx: 78438954.75821584,
      });
    expect(response1.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response1.body.message).toBe(NO_EXTRA_PROPERTY_ERROR_MESSAGE);
    expect(response1.statusCode).toBe(400);
    const response2 = await supertest(app)
      .post('/api/auth')
      .send({
        ...goodData,
        town: 111,
      });
    expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response2.body.message).toBe('town: ' + SHOULD_BE_STRING_ERROR);
    expect(response2.statusCode).toBe(400);
    const response3 = await supertest(app)
      .post('/api/auth')
      .send({
        ...goodData,
      });
    expect(response3.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response3.body.message).toBe('holydayDate: ' + WRONG_DATE_ERROR_MESSAGE);
    expect(response3.statusCode).toBe(400);
  });

  test('It should respond with fail with wrong parameters types', async () => {
    const correctBody = {
      businessName: 'proident nulla dolor',
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail2@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
    };

    const badBody1 = { ...correctBody, extra: 1 };
    const response1 = await supertest(app).post('/api/auth').send(badBody1);
    expect(response1.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response1.statusCode).toBe(400);
  });*/

  test('It should respond with success message when login', async () => {
    const body = {
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail5@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      postCode: 'velit id',
      address_1: 'address_1',
      subscriptionDate: '1989-07-20',
    };
    await supertest(app).post('/api/auth').send(body);

    const response = await supertest(app).post('/api/auth/login').send({
      email: body.email,
      password: body.password,
    });
    expect(response.body).toMatchSchema(schema.components.responses.Login.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with error message when login with wrong credentials', async () => {
    const body = {
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail6@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      postCode: 'velit id',
      address_1: 'address_1',
      subscriptionDate: '1989-07-20',
    };
    await supertest(app).post('/api/auth').send(body);

    const response = await supertest(app).post('/api/auth/login').send({
      email: body.email,
      password: 'wrong!!',
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.body.message).toBe('Wrong credentials');
    expect(response.statusCode).toBe(400);

    const response2 = await supertest(app).post('/api/auth/login').send({
      email: 'wrong@mail.com',
      password: body.password,
    });
    expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response2.body.message).toBe('Credentials not found');
    expect(response2.statusCode).toBe(400);
  });

  test('It should respond with error when using existing email', async () => {
    const body = {
      businessName: faker.company.name(),
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'mail10@mail.com',
      countryId: 2,
      stateId: 42,
      town: 'magna dolore dolor in',
      currencyCode: 'USD',
      address_1: 'address_1',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
    };
    await supertest(app).post('/api/auth').send(body);
    const response = await supertest(app)
      .post('/api/auth')
      .send({
        ...body,
        email: 'mail10@mail.com',
      });

    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.statusCode).toBe(400);
  });
});
