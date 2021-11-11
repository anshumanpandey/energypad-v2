import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import DB from '../src/lib/db/Db';
import schema from '../src/types/Schema.json';

beforeAll(async () => {
  await DB.migrate.latest();
});

describe('GET / ', () => {
  test('It should respond with success message when register', async () => {
    const response = await supertest(app)
      .post('/api/auth')
      .send({
        businessName: 'proident nulla dolor',
        businessType: 'dolor',
        businessService: 'sit nisi',
        password: 'irure in eiusmod sint nostrud',
        siteName: 'nulla esse id voluptate eiusmod',
        buildingName: 'sint consequat',
        contactName: 'labore exercitation id',
        position: 'ullamco tempor exercitation laboris consectetur',
        phoneNumber: 'velit',
        email: 'irure quis non mollit',
        country: 'velit irure dolor',
        state: 'consequat',
        town: 'magna dolore dolor in',
        postCode: 'velit id',
        subscriptionDate: '1989-07-20',
        holydayDate: '1942-04-26',
        totalArea: -76421184.56177847,
        totalPopulation: -78438954.75821584,
        floors: [
          {
            size: 'ea sunt ad occaecat nisi',
            area: -80468912.0731943,
            population: 45307773.70958948,
          },
          {
            size: 'qui sint nostrud amet',
            area: 56596671.00636953,
            population: -40456363.3113292,
          },
          {
            size: 'do enim Excepteur',
            area: -76791716.29185855,
            population: -66051788.61218466,
          },
          {
            size: 'dolor',
            area: -27659464.5653591,
            population: -16922374.744337156,
          },
          {
            size: 'proident aliqua sed ad amet',
            area: 82719690.13532364,
            population: -25006391.526693374,
          },
        ],
      });
    expect(response.body).toMatchSchema(schema.components.responses.Register.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
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
      email: 'irure quis non mollit',
      country: 'velit irure dolor',
      state: 'consequat',
      town: 'magna dolore dolor in',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
      holydayDate: '1942-04-26',
      totalArea: -76421184.56177847,
      totalPopulation: -78438954.75821584,
      floors: [
        {
          size: 'ea sunt ad occaecat nisi',
          area: -80468912.0731943,
          population: 45307773.70958948,
        },
        {
          size: 'qui sint nostrud amet',
          area: 56596671.00636953,
          population: -40456363.3113292,
        },
        {
          size: 'do enim Excepteur',
          area: -76791716.29185855,
          population: -66051788.61218466,
        },
        {
          size: 'dolor',
          area: -27659464.5653591,
          population: -16922374.744337156,
        },
        {
          size: 'proident aliqua sed ad amet',
          area: 82719690.13532364,
          population: -25006391.526693374,
        },
      ],
    };

    const badBody1 = { ...correctBody, extra: 1 };
    const response1 = await supertest(app).post('/api/auth').send(badBody1);
    expect(response1.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response1.statusCode).toBe(400);

    const badBody2 = {
      ...correctBody,
      floors: [
        {
          size: 'proident aliqua sed ad amet',
          area: 'some',
          population: -25006391.526693374,
        },
      ],
    };
    const response2 = await supertest(app).post('/api/auth').send(badBody2);
    expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response2.statusCode).toBe(400);

    const badBody3 = {
      ...correctBody,
      floors: [
        {
          size: 'proident aliqua sed ad amet',
          area: -25006391.526693374,
          population: -25006391.526693374,
          extra: 55,
        },
      ],
    };
    const response3 = await supertest(app).post('/api/auth').send(badBody3);
    expect(response3.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response3.statusCode).toBe(400);
  });

  test('It should respond with success message when login', async () => {
    const body = {
      businessName: 'proident nulla dolor',
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'irure quis non mollit',
      country: 'velit irure dolor',
      state: 'consequat',
      town: 'magna dolore dolor in',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
      holydayDate: '1942-04-26',
      totalArea: -76421184.56177847,
      totalPopulation: -78438954.75821584,
      floors: [
        {
          size: 'ea sunt ad occaecat nisi',
          area: -80468912.0731943,
          population: 45307773.70958948,
        },
      ],
    };
    await supertest(app).post('/api/auth').send(body);

    const response = await supertest(app).post('/api/auth/login').send({
      email: body.email,
      password: body.password,
    });
    expect(response.body).toMatchSchema(schema.components.responses.Login.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with error message when login with wron credentials', async () => {
    const body = {
      businessName: 'proident nulla dolor',
      businessType: 'dolor',
      businessService: 'sit nisi',
      password: 'irure in eiusmod sint nostrud',
      siteName: 'nulla esse id voluptate eiusmod',
      buildingName: 'sint consequat',
      contactName: 'labore exercitation id',
      position: 'ullamco tempor exercitation laboris consectetur',
      phoneNumber: 'velit',
      email: 'irure quis non mollit',
      country: 'velit irure dolor',
      state: 'consequat',
      town: 'magna dolore dolor in',
      postCode: 'velit id',
      subscriptionDate: '1989-07-20',
      holydayDate: '1942-04-26',
      totalArea: -76421184.56177847,
      totalPopulation: -78438954.75821584,
      floors: [
        {
          size: 'ea sunt ad occaecat nisi',
          area: -80468912.0731943,
          population: 45307773.70958948,
        },
      ],
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
});
