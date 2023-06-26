import supertest from 'supertest';
import { app } from '../src/app';
import { NO_EXTRA_PROPERTY_ERROR_MESSAGE, loginUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';
import { ulid } from 'ulid';

expect.extend(matcher);

describe('/Site ', () => {
  test('It should respond with success message when create a site', async () => {
    const body = await loginUser(app)('mail238@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'a site 1',
      type: 'in amet enim',
      code: ulid(),
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: 'somwehre',
      population: 17391920,
      size: 45786843,
      workinghours: 10,
    });
    expect(response.body).toMatchSchema(schema.components.responses.Site.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when updating a site', async () => {
    const body = await loginUser(app)('mail316@mail.com');
    const siteBody = {
      id: 478,
      name: 'cccc',
      type: 'some_new',
      code: ulid(),
      address: 'anywhere_new',
      postCode: '484 sd8_new',
      town: 'some town_new',
      population: 44444444,
      size: 8798,
      workinghours: 88,
    };
    const response = await supertest(app)
      .put('/api/site/update/478')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(siteBody);
    expect(response.body).toMatchSchema(schema.components.responses.SiteUpdate.content['application/json'].schema);
    expect(response.statusCode).toBe(200);

    const details = await supertest(app).get('/api/business/sites').set('Authorization', `Bearer ${body.jwt}`);
    expect(details.body[1].type).toBe(siteBody.type);
    expect(details.body[1].address).toBe(siteBody.address);
    expect(details.body[1].postCode).toBe(siteBody.postCode);
    expect(details.body[1].town).toBe(siteBody.town);
    expect(details.body[1].population).toBe(siteBody.population);
    expect(details.body[1].size).toBe(siteBody.size);
    expect(details.body[1].workinghours).toBe(siteBody.workinghours);
    expect(details.body[1].code).toBe(siteBody.code);

    const siteBody2 = {
      id: 479,
      name: 'ttttt',
      type: 'iuiuiu',
      address: 'yuyucxwh',
      postCode: 'cccccccc',
      town: 'axqqeqweq',
      population: 44444444,
      size: 8798,
      workinghours: 99,
    };
    const response2 = await supertest(app)
      .put('/api/site/update/479')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send(siteBody2);
    expect(response2.body).toMatchSchema(schema.components.responses.SiteUpdate.content['application/json'].schema);
    expect(response2.statusCode).toBe(200);

    const details2 = await supertest(app).get('/api/business/sites').set('Authorization', `Bearer ${body.jwt}`);
    const s = details2.body.find((i: Record<string, string>) => i.name === 'ttttt');
    expect(s.type).toBe(siteBody2.type);
    expect(s.address).toBe(siteBody2.address);
    expect(s.postCode).toBe(siteBody2.postCode);
    expect(s.town).toBe(siteBody2.town);
    expect(s.population).toBe(siteBody2.population);
    expect(s.size).toBe(siteBody2.size);
    expect(s.workinghours).toBe(siteBody2.workinghours);
    expect(s.code).toBeDefined();
  });

  test('It should respond with fail message when create a site when passing wrong data', async () => {
    const body = await loginUser(app)('mail238@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'aaaaa',
      type: 'in amet enim',
      code: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: 35779417.474086836,
      population: 'some',
      size: 45786843.40282458,
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.body.message).toBe('town: should be string');
    expect(response.statusCode).toBe(400);

    const response2 = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      code: ulid(),
      postCode: 'dolor enim',
      town: 'a town',
      population: 'some',
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
      another: 1,
    });
    expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response2.body.message).toBe(NO_EXTRA_PROPERTY_ERROR_MESSAGE);
    expect(response2.statusCode).toBe(400);

    const response3 = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      name: 'bbbb',
      type: 'some_new',
      code: ulid(),
      address: 'anywhere_new',
      postCode: '484 sd8_new',
      town: 'some town_new',
      population: 222222,
      size: 8888,
      workinghours: 'a',
    });
    expect(response3.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response3.body.message).toBe('workinghours: should be number');
    expect(response3.statusCode).toBe(400);
  });

  test('It should respond with success when setting the conversion unit for a site', async () => {
    const body = await loginUser(app)('mail400@mail.com');
    const response = await supertest(app)
      .post('/api/site/setConversionUnit/490')
      .set('Authorization', `Bearer ${body.jwt}`)
      .send([
        { unitType: 'L', unitValue: 58.52 },
        { unitType: 'm3', unitValue: 789.12 },
      ]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(
      schema.components.responses.SetSiteConversionUnit.content['application/json'].schema,
    );
  });

  test('It should respond with success when deleting site', async () => {
    const body = await loginUser(app)('mail312@mail.com');
    const response = await supertest(app).delete('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      id: 474,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.DeleteSite.content['application/json'].schema);
  });

  test('It should respond with error when site does not exist on db', async () => {
    const body = await loginUser(app)('mail312@mail.com');
    const response = await supertest(app).delete('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      id: 999,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
  });

  test('It should respond with success when getting sites details', async () => {
    const body = await loginUser(app)('mail312@mail.com');
    const response = await supertest(app).get('/api/site/details/476').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.GetSiteDetails.content['application/json'].schema);
    expect(response.body.energies[0].usedInId.length).toBe(2);
  });

  test('It should filter sites by fuel source', async () => {
    const body = await loginUser(app)('mail312@mail.com');
    const response = await supertest(app).get('/api/business/sites?fsi=1').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
  });
});
