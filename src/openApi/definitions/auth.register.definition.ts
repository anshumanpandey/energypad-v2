import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getReferenceFor,
} from '../OpenApiDefinition';

const reqName = 'Register';

addRequestComponentFor(reqName, {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
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
    },
  },
});

addResponseComponentFor(reqName, {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
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
          schema: getReferenceFor({ for: 'responses', name: reqName }),
        },
      },
    },
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateUserOperation);
