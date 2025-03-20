import supertest from 'supertest';
import { loginUser } from '../../testhelp';
import { app } from '../../../src/app';

describe('/Single heating or cooling ', () => {
  test('should import and calculate waste fine', async () => {
    const body = await loginUser(app)('admin@energypad.com');

    let response = await supertest(app)
      .post('/api//business/importBusiness')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/lightingAndPower/fixtures/businesses.xlsx');
    expect(response.statusCode).toBe(200);

    const user = await loginUser(app)('bp5@gpad.org.uk', "Gpad@123A90%");
    response = await supertest(app)
      .get('/api/business/sites')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/lightingAndPower/fixtures/profiles.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/lightingAndPower/fixtures/consumptions.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .get('/api/dashboard/energyWaste?year=2024')
      .set('Authorization', `Bearer ${user.jwt}`)
      //console.log(response.body.waste)
    expect(response.statusCode).toBe(200);
    expect(response.body.waste.at(0).length).toBe(12);
    expect(response.body.waste.at(0)[0].waste).toBe(48.061961);
    expect(response.body.waste.at(0)[1].waste).toBe(2.677736);
    expect(response.body.waste.at(0)[2].waste).toBe(5.51646);
    expect(response.body.waste.at(0)[3].waste).toBe(1.026845);
    expect(response.body.waste.at(0)[4].waste).toBe(-170.0275);
    expect(response.body.waste.at(0)[5].waste).toBe(-52.184943);
    expect(response.body.waste.at(0)[6].waste).toBe(1323.414771);
    expect(response.body.waste.at(0)[7].waste).toBe(38.450402);
    expect(response.body.waste.at(0)[8].waste).toBe(-187.517015);
    expect(response.body.waste.at(0)[9].waste).toBe(202.948031);
    expect(response.body.waste.at(0)[10].waste).toBe(34.021952);
    expect(response.body.waste.at(0)[11].waste).toBe(-143.96908);
  });
});
