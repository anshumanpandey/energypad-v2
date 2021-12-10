import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  createSchema,
  addResponseComponentFor,
} from '../OpenApiDefinition';

createSchema({
  name: 'RegisterBody',
  schema: {
    required: [
      'businessName',
      'businessType',
      'businessService',
      'password',
      'siteName',
      'buildingName',
      'contactName',
      'position',
      'phoneNumber',
      'email',
      'country',
      'state',
      'town',
      'postCode',
      'subscriptionDate',
      'holydayDate',
      'totalArea',
      'totalPopulation',
      'floors',
    ],
    properties: {
      businessName: { type: 'string' },
      businessType: { type: 'string' },
      businessService: { type: 'string' },
      password: { type: 'string', transform: ['trim'], writeOnly: true },
      siteName: { type: 'string' },
      buildingName: { type: 'string' },
      contactName: { type: 'string' },
      position: { type: 'string' },
      phoneNumber: { type: 'string' },
      email: { type: 'string', transform: ['trim'] },
      country: { type: 'string' },
      state: { type: 'string' },
      town: { type: 'string' },
      postCode: { type: 'string' },
      subscriptionDate: { type: 'string', format: 'date' },
      holydayDate: { type: 'string', format: 'date' },
      totalArea: { type: 'number', format: 'int32' },
      totalPopulation: { type: 'number', format: 'int32' },
      floors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['size', 'area', 'population'],
          properties: {
            size: { type: 'string' },
            area: { type: 'number', format: 'int32' },
            population: { type: 'number', format: 'int32' },
          },
        },
      },
      cooling: getReferenceFor({ for: 'schemas', name: 'BusinessService' }),
      heating: getReferenceFor({ for: 'schemas', name: 'BusinessService' }),
      lighting: getReferenceFor({ for: 'schemas', name: 'BusinessService' }),
      powering: getReferenceFor({ for: 'schemas', name: 'BusinessService' }),
      programmes: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'Programme' }),
      },
    },
  },
});

addRequestComponentFor('Register', {
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'RegisterBody' }),
    },
  },
});

addResponseComponentFor('Register', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const CreateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'Register' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'Register' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateUserOperation);
