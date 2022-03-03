import supertest from 'supertest';
import { app } from '../src/app';
import { loginUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';

expect.extend(matcher);

describe('/Dashboard ', () => {
  test('It should respond with success message when create an utility', async () => {
    const body = await loginUser('mail322@mail.com');
    const response = await supertest(app)
      .get('/api/dashboard?year=2020&fuelSourceId=1&siteId=484')
      .set('Authorization', `Bearer ${body.jwt}`);

    expect(response.body).toMatchSchema(
      schema.components.responses.GetDashboardData.content['application/json'].schema,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.consumptions.length).toBe(3);
    expect(response.body.energyTargets.length).toBe(3);

    expect(response.body.consumptions[0].increasedConsumptionPercentage).toBe(9800);
    expect(response.body.consumptions[1].increasedConsumptionPercentage).toBe(-59.6);
    expect(response.body.consumptions[2].increasedConsumptionPercentage).toBe(75);

    expect(response.body.consumptions[0].increasedCostPercentage).toBe(19700);
    expect(response.body.consumptions[1].increasedCostPercentage).toBe(-59.6);
    expect(response.body.consumptions[2].increasedCostPercentage).toBe(75);

    expect(response.body.energyTargets.length).toBe(3);

    expect(response.body.consumptionsDetails[0].date).toBe('2020-01-01');
    expect(response.body.consumptionsDetails[0].fuelSourceName).toBe('Electricity');
    expect(response.body.consumptionsDetails[0].incesedPercentage).toBe(9800);

    expect(response.body.consumptionsDetails[1].date).toBe('2020-02-01');
    expect(response.body.consumptionsDetails[1].fuelSourceName).toBe('Electricity');
    expect(response.body.consumptionsDetails[1].incesedPercentage).toBe(-59.6);

    expect(response.body.consumptionsDetails[2].date).toBe('2020-03-01');
    expect(response.body.consumptionsDetails[2].fuelSourceName).toBe('Electricity');
    expect(response.body.consumptionsDetails[2].incesedPercentage).toBe(75);

    const response2 = await supertest(app)
      .get('/api/dashboard?year=2023&fuelSourceId=1&siteId=484')
      .set('Authorization', `Bearer ${body.jwt}`);

    console.log(response2.body);

    expect(response2.body.consumptionsDetails.length).toBe(2);
  });
});
