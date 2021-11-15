import supertest from 'supertest';
import { app } from '../src/app';

export const loginUser = async () => {
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
    email: `mail${new Date().toString()}@mail.com`,
    country: 'velit irure dolor',
    state: 'consequat',
    town: 'magna dolore dolor in',
    postCode: 'velit id',
    subscriptionDate: '1989-07-20',
    holydayDate: '1942-04-26',
    totalArea: 76421184.56177847,
    totalPopulation: 78438954.75821584,
    floors: [
      {
        size: 'ea sunt ad occaecat nisi',
        area: 80468912.0731943,
        population: 45307773.70958948,
      },
    ],
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
