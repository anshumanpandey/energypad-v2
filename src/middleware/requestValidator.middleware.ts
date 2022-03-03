import { List, ValidateFunction, Validator } from 'express-json-validator-middleware';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenAPIV3 } from 'openapi-types';
import { QueryParamsKeys, RequestBodieKeys } from '../types/types';

type ParsedSchema = Pick<OpenAPIV3.Document, 'components' | 'paths'>;
let CurrentSchema: ParsedSchema = {
  components: {
    requestBodies: {},
  },
  paths: {},
};

const getJsonSchema: () => boolean | ParsedSchema = () => {
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

export const int32Format = {
  type: 'number' as const,
  validate: (val: number) => {
    if (val < 0) return false;
    return true;
  },
};
ajv.addFormat('int32', int32Format);

export const timeFormat = {
  type: 'string' as const,
  validate: (val: string) => {
    const [hours, minutes, seconds] = val.split(':');
    if (!hours) return false;
    if (!minutes) return false;
    if (!seconds) return false;

    const hoursNumber = parseInt(hours, 10);
    const minutesNumber = parseInt(minutes, 10);
    const secondsNumber = parseInt(seconds, 10);

    if (hoursNumber < 0 || hoursNumber > 24) return false;
    if (minutesNumber < 0 || minutesNumber > 60) return false;
    if (secondsNumber < 0 || secondsNumber > 60) return false;

    return true;
  },
};
ajv.addFormat('time', timeFormat);

export const dateFormat = {
  type: 'string' as const,
  validate: (val: string) => {
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
};
ajv.addFormat('date', dateFormat);

const requestValidator = (p: { body?: RequestBodieKeys; query?: keyof QueryParamsKeys }) => {
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

  /*if (p.query) {
    const queryParameters = schema.paths[p.query]?.get?.parameters.query as any;
    if (queryParameters) {
      if ('content' in requestBody) {
        list = {
          body: requestBody.content['application/json'].schema,
        };
      }
    }
  }*/
  return validate(list);
};

export default requestValidator;
