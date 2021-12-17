import supertest from 'supertest';
import { int32Format } from '../src/middleware/requestValidator.middleware';
import { matchersWithOptions } from 'jest-json-schema';
import { app } from '../src/app';

export const matcher = matchersWithOptions({
  formats: {
    int32: int32Format,
  },
});

export const registerUser = async (email?: string, password?: string) => {
  const body = {
    businessName: 'proident nulla dolor',
    businessType: 'dolor',
    businessService: 'sit nisi',
    password: password || 'irure in eiusmod sint nostrud',
    siteName: 'nulla esse id voluptate eiusmod',
    buildingName: 'sint consequat',
    contactName: 'labore exercitation id',
    position: 'ullamco tempor exercitation laboris consectetur',
    phoneNumber: 'velit',
    email: email ? email : `mail${new Date().valueOf().toString()}@mail.com`,
    country: 'velit irure dolor',
    state: 'consequat',
    town: 'magna dolore dolor in',
    postCode: 'velit id',
    subscriptionDate: '1989-07-20',
    holydayDate: '1942-04-26',
    totalArea: 76421184.56177847,
    totalPopulation: 78438954.75821584,
  };

  await supertest(app).post('/api/auth').send(body);
  return supertest(app)
    .post('/api/auth/login')
    .send({
      email: body.email,
      password: body.password,
    })
    .then((res) => {
      return res.body;
    });
};

export const loginUser = (email: string, password?: string) => {
  return supertest(app)
    .post('/api/auth/login')
    .send({
      email: email,
      password: password || '123456Abc!',
    })
    .then((res) => {
      return res.body;
    });
};

export const SHOULD_BE_STRING_ERROR = 'should be string';
export const NO_EXTRA_PROPERTY_ERROR_MESSAGE = 'should NOT have additional properties';
export const WRONG_DATE_ERROR_MESSAGE = 'should match format "date"';
export const WRONG_NUMBER_ERROR_MESSAGE = 'should match format "int32"';
