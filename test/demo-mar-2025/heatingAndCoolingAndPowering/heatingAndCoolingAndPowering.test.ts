import supertest from 'supertest';
import { loginUser } from '../../testhelp';
import { app } from '../../../src/app';

describe('/Single heating or cooling ', () => {
  test('should import and calculate waste fine', async () => {
    const body = await loginUser(app)('admin@energypad.com');

    let response = await supertest(app)
      .post('/api//business/importBusiness')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCoolingAndPowering/fixtures/businesses.xlsx');
    expect(response.statusCode).toBe(200);

    const user = await loginUser(app)('bp4@gpad.org.uk', "Gpad@123A90%");
    response = await supertest(app)
      .get('/api/business/sites')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCoolingAndPowering/fixtures/profiles.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCoolingAndPowering/fixtures/consumptions.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .get('/api/dashboard/energyWaste?year=2024')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.waste[0].length).toBe(12);
    expect(response.body.waste[0][0].waste).toBe(186.11571);
    expect(response.body.waste[0][1].waste).toBe(268.09332);
    expect(response.body.waste[0][2].waste).toBe(-158.554449);
    expect(response.body.waste[0][3].waste).toBe(-174.853931);
    expect(response.body.waste[0][4].waste).toBe(1000.493285);
    expect(response.body.waste[0][5].waste).toBe(375.532742);
    expect(response.body.waste[0][6].waste).toBe(545.101701);
    expect(response.body.waste[0][7].waste).toBe(-115.223656);
    expect(response.body.waste[0][8].waste).toBe(-98.252149);
    expect(response.body.waste[0][9].waste).toBe(-201.424284);
    expect(response.body.waste[0][10].waste).toBe(178.373185);
    expect(response.body.waste[0][11].waste).toBe(-81.138293);
  });
});
