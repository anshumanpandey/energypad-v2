import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getSchemaComponentFor,
} from '../OpenApiDefinition';

const reqName = 'Register';

addRequestComponentFor(reqName, {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: [
          'address',
          'email',
          'password',
          'sites',
          'bussinesName',
          'propertyName',
          'postCode',
          'town',
          'population',
          'size',
          'fuel',
          'uses',
        ],
        properties: {
          address: { type: 'string' },
          email: { type: 'string' },
          password: { type: 'string' },
          sites: { type: 'string' },
          bussinesName: { type: 'string' },
          propertyName: { type: 'string' },
          postCode: { type: 'string' },
          town: { type: 'string' },
          population: { type: 'number' },
          size: { type: 'number' },
          fuel: { type: 'string' },
          uses: { type: 'string' },
        },
      },
    },
  },
});

addResponseComponentFor(reqName, {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getSchemaComponentFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const CreateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  parameters: OpenApiDefinition.component('requestBodies', reqName),
  responses: {
    '200': {
      description: 'Success message',
      content: {
        'application/json': {
          schema: getSchemaComponentFor({ for: 'responses', name: reqName }),
        },
      },
    },
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateUserOperation);
