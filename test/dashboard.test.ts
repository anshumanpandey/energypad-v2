import supertest from 'supertest';
import { app } from '../src/app';
import { Json, loginUser, matcher } from './testhelp';

expect.extend(matcher);

describe('/Dashboard ', () => {
  test(
    'It should respond with success message when create an utility',
    async () => {
      const body = await loginUser(app)('mail322@mail.com');
      const response = await supertest(app)
        .get('/api/dashboard?year=2020&fuelSourceId=1&siteId=484')
        .set('Authorization', `Bearer ${body.jwt}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.consumptions.length).toBe(1);
      expect(response.body.energyTargets.length).toBe(3);

      expect(response.body.consumptions[0].find((c: Json) => c.date === '2020-01-01').consumption).toBe(200);
      expect(response.body.consumptions[0].find((c: Json) => c.date === '2020-02-01').consumption).toBe(89);

      const response2 = await supertest(app)
        .get('/api/dashboard?year=2022&fuelSourceId=1')
        .set('Authorization', `Bearer ${body.jwt}`);

      expect(response2.body.consumptions.flat().length).toBe(2);
      expect(response2.body.consumptionsDetails.length).toBe(3);

      const response3 = await supertest(app)
        .get('/api/dashboard?year=2022&fuelSourceId=6')
        .set('Authorization', `Bearer ${body.jwt}`);

      expect(response3.body.consumptions.flat().length).toBe(0);
      expect(response3.body.energyTargets.length).toBe(0);
    },
    15 * 1000,
  );
  test(
    'It should respond with success message no fuelSourceId and no siteId is pass',
    async () => {
      const body = await loginUser(app)('mail322@mail.com');
      const response = await supertest(app).get('/api/dashboard?year=2020').set('Authorization', `Bearer ${body.jwt}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.consumptions.length).toBe(4);
      expect(
        response.body.consumptions.find(
          (c: Json[]) =>
            c.find((i) => i.date === '2020-01-01' && i.fuelSourceId === 1 && i.siteId === 484) !== undefined,
        ).length,
      ).toBe(3);
      expect(
        response.body.consumptions.find(
          (c: Json[]) =>
            c.find((i) => i.date === '2020-01-01' && i.fuelSourceId === 2 && i.siteId === 484) !== undefined,
        ).length,
      ).toBe(1);
      expect(
        response.body.consumptions.find(
          (c: Json[]) => c.find((i) => i.fuelSourceId === 1 && i.siteId === 486) !== undefined,
        ).length,
      ).toBe(1);
      expect(
        response.body.consumptions.find(
          (c: Json[]) => c.find((i) => i.fuelSourceId === 2 && i.siteId === 486) !== undefined,
        ).length,
      ).toBe(1);
      expect(response.body.energyTargets.length).toBe(3);
      expect(response.body.energyTargets.flat().every((r: Json) => (r.date as string).endsWith('-01'))).toBe(true);
    },
    15 * 1000,
  );
  test(
    'It should respond with success message no fuelSourceId and no siteId is pass',
    async () => {
      const body = await loginUser(app)('mail700@mail.com');
      const response = await supertest(app).get('/api/dashboard?year=2023').set('Authorization', `Bearer ${body.jwt}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.consumptions.length).toBe(3);
      expect(response.body.consumptions.flat().every((r: Json) => (r.date as string).startsWith('2023'))).toBe(true);
    },
    15 * 1000,
  );

  test(
    'It should respond with correct carbonFootprint data',
    async () => {
      const body = await loginUser(app)('mail322@mail.com');

      const response = await supertest(app)
        .get('/api/dashboard/carbonFootprint?year=2020&fuelSourceId=2&siteId=486')
        .set('Authorization', `Bearer ${body.jwt}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.carbonEmissions.length).toBe(1);
      expect(response.body.allCarbonEmissions.length).toBe(1);

      const response2 = await supertest(app)
        .get('/api/dashboard/carbonFootprint?year=2020')
        .set('Authorization', `Bearer ${body.jwt}`);

      expect(response2.statusCode).toBe(200);
      expect(response2.body.carbonEmissions.length).toBe(2);
      expect(response2.body.allCarbonEmissions.length).toBe(2);
    },
    15 * 1000,
  );
});
