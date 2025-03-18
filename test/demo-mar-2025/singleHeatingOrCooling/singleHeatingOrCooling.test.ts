import supertest from 'supertest';
import { loginUser } from '../../testhelp';
import { app } from '../../../src/app';

describe('/Single heating or cooling ', () => {
  test('should import and calculate waste fine', async () => {
    const body = await loginUser(app)('admin@energypad.com');

    let response = await supertest(app)
      .post('/api//business/importBusiness')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/businesses.xlsx');
    expect(response.statusCode).toBe(200);

    const user = await loginUser(app)('bp1@gpad.org.uk', "Binod9774%");
    response = await supertest(app)
      .get('/api/business/sites')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/profiles.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/consumptions.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .get('/api/dashboard/energyWaste?year=2024')
      .set('Authorization', `Bearer ${user.jwt}`)
      //console.log(response.body.waste)
    expect(response.statusCode).toBe(200);
    expect(response.body.waste.at(0).length).toBe(12);
    expect(response.body.waste.at(0)[0].waste).toBe(59.51);
    expect(response.body.waste.at(0)[1].waste).toBe(117.56);
    expect(response.body.waste.at(0)[2].waste).toBe(-23.48);
    expect(response.body.waste.at(0)[3].waste).toBe(-27.67);
    expect(response.body.waste.at(0)[4].waste).toBe(5428.33);
    expect(response.body.waste.at(0)[5].waste).toBe(1307.27);
    expect(response.body.waste.at(0)[6].waste).toBe(222.10);
    expect(response.body.waste.at(0)[7].waste).toBe(-132.92);
    expect(response.body.waste.at(0)[8].waste).toBe(99.09);
    expect(response.body.waste.at(0)[9].waste).toBe(-183.08);
    expect(response.body.waste.at(0)[10].waste).toBe(-113.42);
    expect(response.body.waste.at(0)[11].waste).toBe(424.01);
  });
});
