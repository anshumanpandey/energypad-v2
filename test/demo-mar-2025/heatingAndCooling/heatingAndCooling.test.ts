import supertest from 'supertest';
import { loginUser } from '../../testhelp';
import { app } from '../../../src/app';

describe('/Single heating or cooling ', () => {
  test('should import and calculate waste fine', async () => {
    const body = await loginUser(app)('admin@energypad.com');

    let response = await supertest(app)
      .post('/api//business/importBusiness')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCooling/fixtures/businesses.xlsx');
    expect(response.statusCode).toBe(200);

    const user = await loginUser(app)('bp3@gpad.org.uk', "Gpad@123A90%");
    response = await supertest(app)
      .get('/api/business/sites')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);

    response = await supertest(app)
      .post('/api/business/importPatterns')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCooling/fixtures/profiles.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .post('/api/utility/importUtilityEmissions')
      .set('Authorization', `Bearer ${body.jwt}`)
      .attach('excel', 'test/demo-mar-2025/heatingAndCooling/fixtures/consumptions.xlsx');
    expect(response.statusCode).toBe(200);

    response = await supertest(app)
      .get('/api/dashboard/energyWaste?year=2024')
      .set('Authorization', `Bearer ${user.jwt}`)
    expect(response.statusCode).toBe(200);
    expect(response.body.waste[0].length).toBe(24);
    const heating = response.body.waste[0].filter((i:any) => i.usedIn === "Heating").sort((a:any,b:any) => a.date.localeCompare(b.date))
    expect(heating[0].waste).toBe(103.171246);
    expect(heating[1].waste).toBe(115.605702);
    expect(heating[2].waste).toBe(-164.809484);
    expect(heating[3].waste).toBe(-173.032487);
    expect(heating[4].waste).toBe(5539.958168);
    expect(heating[5].waste).toBe(601.078495);
    expect(heating[6].waste).toBe(76.370365);
    expect(heating[7].waste).toBe(-143.057471);
    expect(heating[8].waste).toBe(1103.388656);
    expect(heating[9].waste).toBe(-213.522888);
    expect(heating[10].waste).toBe(147.451771);
    expect(heating[11].waste).toBe(1094.897499);
  });
});
