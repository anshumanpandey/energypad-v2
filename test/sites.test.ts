import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser, NO_EXTRA_PROPERTY_ERROR_MESSAGE, WRONG_NUMBER_ERROR_MESSAGE } from './testhelp';
import schema from '../src/types/Schema.json';
import DB from '../src/lib/db/Db';

beforeAll(async () => {
  await DB.migrate.latest();
});

describe('/Site ', () => {
  test('It should respond with success message when create a site', async () => {
    const body = await loginUser();
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: 35779417.474086836,
      population: 17391920.135333613,
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
    });
    expect(response.body).toMatchSchema(schema.components.responses.Site.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with fail message when create a site', async () => {
    const body = await loginUser();
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: 35779417.474086836,
      population: 'some',
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.body.message).toBe('should be number');
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
});
