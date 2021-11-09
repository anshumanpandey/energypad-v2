import 'module-alias/register';
import openapiTS from 'openapi-typescript';
import { writeFile } from 'fs';
import express from 'express';
import v1 from '@routes/v1';
import OpenApiDefinition from '@openApi';

const PORT_NUMBER = 5454;
const app = express();
app.use(OpenApiDefinition);
app.use('/api', v1);

const writeFileGenerated = (content: string) => {
  writeFile('./src/types/Generated.ts', content, function (err) {
    if (err) {
      throw err;
    }
    console.log('Generated types from OpenAPI specification!');
  });
};

const onConnected = () => {
  openapiTS(`http://localhost:${PORT_NUMBER}/openapi.json`)
    .then((result) => {
      writeFileGenerated(result);
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      server.close();
    });
};

const server = app.listen(PORT_NUMBER, onConnected);
