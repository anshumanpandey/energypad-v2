import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SaveBusinessEnergy', {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['siteId', 'records'],
        properties: {
          siteId: {
            type: 'number',
            format: 'int32',
          },
          records: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'BusinessEnergy' }),
          },
        },
      },
    },
  },
});

addResponseComponentFor('SaveBusinessEnergy', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const AddBrandToBusinessOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SaveBusinessEnergy' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SaveBusinessEnergy' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddBrandToBusinessPath = OpenApiDefinition.path(AddBrandToBusinessOperation);
