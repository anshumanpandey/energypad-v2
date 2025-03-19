import supertest from 'supertest';
import { loginUser } from '../../testhelp';
import { app } from '../../../src/app';

describe('/Single heating or cooling ', () => {
  test('should import and calculate waste fine', async () => {
    const body = await loginUser(app)('admin@energypad.com');

    let response = await supertest(app)
      .post('/api//business/importBusiness')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/businesses.xlsx');
    expect(response.statusCode).toBe(200);

    const user = await loginUser(app)('bp2@gpad.org.uk', "Binod9774%");
    response = await supertest(app)
      .get('/api/business/sites')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/profiles.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/consumptions.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .get('/api/dashboard/energyWaste?year=2024')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.waste.at(0).length).toBe(12);
    expect(response.body.waste.at(0)[0].waste).toBe(126.585597);
    expect(response.body.waste.at(0)[1].waste).toBe(271.156043);
    expect(response.body.waste.at(0)[2].waste).toBe(26.564406);
    expect(response.body.waste.at(0)[3].waste).toBe(-41.543618);
    expect(response.body.waste.at(0)[4].waste).toBe(977.070488);
    expect(response.body.waste.at(0)[5].waste).toBe(886.545622);
    expect(response.body.waste.at(0)[6].waste).toBe(952.172793);
    expect(response.body.waste.at(0)[7].waste).toBe(-99.661536);
    expect(response.body.waste.at(0)[8].waste).toBe(-180.190512);
    expect(response.body.waste.at(0)[9].waste).toBe(-138.883148);
    expect(response.body.waste.at(0)[10].waste).toBe(-107.135742);
    expect(response.body.waste.at(0)[11].waste).toBe(-120.783722);
  });
});
