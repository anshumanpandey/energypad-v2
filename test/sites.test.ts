import supertest from 'supertest';
import { app } from '../src/app';
import { NO_EXTRA_PROPERTY_ERROR_MESSAGE, loginUser, matcher } from './testhelp';
import schema from '../src/types/Schema.json';

expect.extend(matcher);

describe('/Site ', () => {
  test('It should respond with success message when create a site', async () => {
    const body = await loginUser('mail238@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: 'somwehre',
      population: 17391920.135333613,
      size: 45786843.40282458,
    });
    expect(response.body).toMatchSchema(schema.components.responses.Site.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with success message when updating a site', async () => {
    const body = await loginUser('mail316@mail.com');
    const response = await supertest(app).put('/api/site/update/478').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'some_new',
      address: 'anywhere_new',
      postCode: '484 sd8_new',
      town: 'some town_new',
      population: 222222,
      size: 8888,
    });
    expect(response.body).toMatchSchema(schema.components.responses.SiteUpdate.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with fail message when create a site when passing wrong town', async () => {
    const body = await loginUser('mail238@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
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
      postCode: 'dolor enim',
      town: 35779417.474086836,
      population: 'some',
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
      another: 1,
    });
    expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response2.body.message).toBe(NO_EXTRA_PROPERTY_ERROR_MESSAGE);
    expect(response2.statusCode).toBe(400);
  });

  test('It should respond with success when deleting site', async () => {
    const body = await loginUser('mail312@mail.com');
    const response = await supertest(app).delete('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      id: 474,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.DeleteSite.content['application/json'].schema);
  });

  test('It should respond with error when site does not exist on db', async () => {
    const body = await loginUser('mail312@mail.com');
    const response = await supertest(app).delete('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      id: 999,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
  });

  test('It should respond with success when getting sites details', async () => {
    const body = await loginUser('mail312@mail.com');
    const response = await supertest(app).get('/api/site/details/476').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchSchema(schema.components.responses.GetSiteDetails.content['application/json'].schema);
    expect(response.body.energies[0].usedInId.length).toBe(2);
  });

  test('It should filter sites by fuel source', async () => {
    const body = await loginUser('mail312@mail.com');
    const response = await supertest(app).get('/api/business/sites?fsi=1').set('Authorization', `Bearer ${body.jwt}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
  });
});
