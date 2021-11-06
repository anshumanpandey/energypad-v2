import 'module-alias/register';
import toSchema from '@openapi-contrib/openapi-schema-to-json-schema';
import { Resolver } from '@stoplight/json-ref-resolver';
import { writeFile } from 'fs';
import { get } from 'http';
import express from 'express';
import OpenApiDefinition from '@openApi';

const PORT_NUMBER = 5454;
const resolver = new Resolver();
const app = express();

app.use(OpenApiDefinition);

const makeRequest = () => {
  return new Promise<Record<string, string>>((resolved, rejected) => {
    get(`http://localhost:${PORT_NUMBER}/openapi.json`, (res) => {
      const data: any = [];

      res.on('data', (chunk) => {
        data.push(chunk);
      });

      res.on('end', () => {
        const json = JSON.parse(Buffer.concat(data).toString());
        resolver.resolve(json).then((fullJsonScheman) => {
          resolved(fullJsonScheman.result);
        });
      });
    }).on('error', (err) => {
      console.log('Error: ', err.message);
      rejected(err);
    });
  });
};

const writeFileGenerated = (content: string) => {
  writeFile('./src/types/Schema.json', content, function (err) {
    if (err) {
      throw err;
    }
    console.log('Generated types from JSON schema specification!');
  });
};

const onConnected = () => {
  makeRequest()
    .then((r) => toSchema(r))
    .then((result) => result)
    .then((result) => {
      writeFileGenerated(JSON.stringify(result, null, '\t'));
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      server.close();
    });
};

const server = app.listen(PORT_NUMBER, onConnected);
