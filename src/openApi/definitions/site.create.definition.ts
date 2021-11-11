import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getReferenceFor,
} from '../OpenApiDefinition';

addRequestComponentFor('Site', {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'address', 'postCode', 'town', 'population', 'size', 'fuel', 'uses'],
        properties: {
          type: { type: 'string' },
          address: { type: 'string' },
          postCode: { type: 'string' },
          town: { type: 'number' },
          population: { type: 'number' },
          size: { type: 'string' },
          fuel: { type: 'string' },
          uses: { type: 'string' },
        },
      },
    },
  },
});

addResponseComponentFor('Site', {
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

const CreateSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  parameters: OpenApiDefinition.component('requestBodies', 'Site'),
  responses: {
    '200': {
      description: 'Success message',
      content: {
        'application/json': {
          schema: getReferenceFor({ for: 'responses', name: 'Site' }),
        },
      },
    },
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateSiteOperation);
