import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getReferenceFor,
  createSchema,
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
      password: { type: 'string', writeOnly: true },
      siteName: { type: 'string' },
      buildingName: { type: 'string' },
      contactName: { type: 'string' },
      position: { type: 'string' },
      phoneNumber: { type: 'string' },
      email: { type: 'string' },
      country: { type: 'string' },
      state: { type: 'string' },
      town: { type: 'string' },
      postCode: { type: 'string' },
      subscriptionDate: { type: 'string', format: 'date' },
      holydayDate: { type: 'string', format: 'date' },
      totalArea: { type: 'number' },
      totalPopulation: { type: 'number' },
      floors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['size', 'area', 'population'],
          properties: {
            size: { type: 'string' },
            area: { type: 'number' },
            population: { type: 'number' },
          },
        },
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
      schema: {
        oneOf: [
          getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
          getReferenceFor({ for: 'schemas', name: 'GenericError' }),
        ],
      },
    },
  },
});

const CreateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  parameters: [getReferenceFor({ for: 'responses', name: 'Register' })],
  responses: {
    '200': {
      description: 'Success message',
      content: {
        'application/json': {
          schema: getReferenceFor({ for: 'responses', name: 'Register' }),
        },
      },
    },
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateUserOperation);
