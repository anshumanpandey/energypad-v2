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

ajv.addFormat('date', {
  type: 'string',
  validate: (val) => {
    const reg = new RegExp(/^(\d+)-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/);
    if (reg.test(val) === false) return false;

    const [year, month, day] = val.split('-');
    const numberDay = parseInt(day, 10);
    const numberYear = parseInt(year, 10);
    const isLeapYear = numberYear % 100 === 0 ? numberYear % 400 === 0 : numberYear % 4 === 0;

    switch (month) {
      case '01':
        if (numberDay > 31) return false;
        break;
      case '02':
        if (isLeapYear) {
          if (numberDay > 29) return false;
        } else {
          if (numberDay > 28) return false;
        }
        break;
      case '03':
        if (numberDay > 31) return false;
        break;
      case '04':
        if (numberDay > 30) return false;
        break;
      case '05':
        if (numberDay > 31) return false;
        break;
      case '06':
        if (numberDay > 30) return false;
        break;
      case '07':
        if (numberDay > 31) return false;
        break;
      case '08':
        if (numberDay > 31) return false;
        break;
      case '09':
        if (numberDay > 30) return false;
        break;
      case '10':
        if (numberDay > 31) return false;
        break;
      case '11':
        if (numberDay > 30) return false;
        break;
      case '12':
        if (numberDay > 31) return false;
        break;
      default:
        return true;
    }

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
