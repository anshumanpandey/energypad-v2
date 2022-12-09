import supertest from 'supertest';
import { faker } from '@faker-js/faker';
import { int32Format } from '../src/middleware/requestValidator.middleware';
import { matchersWithOptions } from 'jest-json-schema';

export const matcher = matchersWithOptions({
  formats: {
    int32: int32Format,
  },
});

export const registerUser = (app: Express.Application) => async (email?: string, password?: string) => {
  const body = {
    businessName: faker.company.name(),
    businessType: 'dolor',
    businessService: 'sit nisi',
    password: password || 'irure in eiusmod sint nostrud',
    siteName: 'nulla esse id voluptate eiusmod',
    buildingName: 'sint consequat',
    contactName: 'labore exercitation id',
    position: 'ullamco tempor exercitation laboris consectetur',
    phoneNumber: 'velit',
    email: email ? email : `mail${new Date().valueOf().toString()}@mail.com`,
    countryId: 2,
    stateId: 42,
    town: 'magna dolore dolor in',
    currencyCode: 'USD',
    postCode: 'velit id',
    address_1: 'address_1',
    subscriptionDate: '1989-07-20',
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

export const loginUser = (app: Express.Application) => (email: string, password?: string) => {
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

export const buildFakeBusiness = (p: { id: number; email: string }) => {
  return {
    id: p.id,
    businessName: faker.company.name(),
    businessType: 'a type',
    businessService: 'a service',
    password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW', // 123456Abc!
    siteName: 'a site',
    buildingName: 'a name',
    contactName: 'a contact name',
    position: 'a position',
    phoneNumber: '+55 122334444',
    email: p.email,
    countryId: 2,
    stateId: 42,
    town: 'a town',
    currencyCode: 'USD',
    postCode: '485 s8d',
    subscriptionDate: new Date().toISOString().split('T')[0],
  };
};

export const buildFakeSite = (p: { id: number; businessId: number; name?: string }) => ({
  id: p.id,
  name: p.name || faker.word.noun() + Math.random().toString(),
  type: 'some',
  address: 'anywhere',
  postCode: '484 sd8',
  town: 'some town',

  population: 15000,
  workinghours: 2,
  size: 15,
  businessId: p.businessId,
});

export const buildFakeEmission = (p: {
  id: number;
  siteId: number;
  fuelSourceId: number;
  usedInId: number;
  date?: string;
}) => ({
  id: p.id,
  conversionFactor: 20,
  consumption: 20,
  fuelUnit: 'm3',
  emissionFactor: 25,
  date: p.date || '2020-01-01',

  siteId: p.siteId,
  fuelSourceId: p.fuelSourceId,
});

export const buildFakeConsumption = (p: {
  id: number;
  date: string;
  consumption: number;
  siteId: number;
  fuelSourceId: number;
}) => {
  return {
    id: p.id,
    date: p.date,
    consumption: p.consumption,
    vat: 20,
    conversionFactor: 10,
    totalCost: 10,
    fuelUnit: 'm3',
    siteId: p.siteId,
    fuelSourceId: p.fuelSourceId,
  };
};

export const SHOULD_BE_STRING_ERROR = 'should be string';
export const NO_EXTRA_PROPERTY_ERROR_MESSAGE = 'should NOT have additional properties';
export const WRONG_DATE_ERROR_MESSAGE = 'should match format "date"';
export const WRONG_NUMBER_ERROR_MESSAGE = 'should match format "int32"';
