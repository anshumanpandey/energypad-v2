import supertest from 'supertest';
import { matchers } from 'jest-json-schema';
expect.extend(matchers);
import { app } from '../src/app';
import { loginUser } from './testhelp';
import schema from '../src/types/Schema.json';
import DB from '../src/lib/db/Db';

beforeAll(async () => {
  await DB.migrate.latest();
});

describe('/Site ', () => {
  test('It should respond with success message when create a site', async () => {
    const body = await loginUser('mail1@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: -35779417.474086836,
      population: 17391920.135333613,
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
    });
    expect(response.body).toMatchSchema(schema.components.responses.Site.content['application/json'].schema);
    expect(response.statusCode).toBe(200);
  });

  test('It should respond with fail message when create a site', async () => {
    const body = await loginUser('mail1@mail.com');
    const response = await supertest(app).post('/api/site').set('Authorization', `Bearer ${body.jwt}`).send({
      type: 'in amet enim',
      address: 'irure aliquip cillum esse magna',
      postCode: 'dolor enim',
      town: -35779417.474086836,
      population: 'some',
      size: 45786843.40282458,
      fuel: 'sed sint incididunt',
      uses: 'anim consectetur eu',
    });
    expect(response.body).toMatchSchema(schema.components.schemas.GenericError);
    expect(response.statusCode).toBe(400);
  });
});
