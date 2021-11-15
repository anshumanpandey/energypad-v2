import { List, ValidateFunction, Validator } from 'express-json-validator-middleware';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenAPIV3 } from 'openapi-types';
import { RequestBodieKeys } from '../types/types';
let CurrentSchema: Pick<OpenAPIV3.Document, 'components'> = {
  components: {
    requestBodies: {},
  },
};

const getJsonSchema: () => boolean | Pick<OpenAPIV3.Document, 'components'> = () => {
  const path = join('src', 'types', 'Schema.json');
  let schema = true;
  if (existsSync(path)) {
    const jsonString = readFileSync(path, { encoding: 'utf-8' });
    schema = JSON.parse(jsonString);
  }
  return schema;
};

const validatorOptions = {
  loadSchema: () => {
    const result = getJsonSchema();
    if (typeof result !== 'boolean') {
      CurrentSchema = result;
    }
    return Promise.resolve(result);
  },
  validateSchema: true,
  inlineRefs: true,
};
const { validate, ajv } = new Validator(validatorOptions);

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ajv-keywords')(ajv, 'transform');

ajv.addFormat('int32', {
  type: 'number',
  validate: (val) => {
    if (val < 0) return false;
    return true;
  },
});

const requestValidator = (p: List<RequestBodieKeys>) => {
  const result = getJsonSchema();
  let schema = CurrentSchema;
  if (typeof result !== 'boolean') {
    schema = result;
  }
  let list: List<ValidateFunction> = {};
  if (p.body) {
    const requestBody = schema?.components?.requestBodies?.[p.body];
    if (requestBody) {
      if ('content' in requestBody) {
        list = {
          body: requestBody.content['application/json'].schema,
        };
      }
    }
  }
  return validate(list);
};

export default requestValidator;
