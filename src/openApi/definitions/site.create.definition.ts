import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('Site', {
  required: true,
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'Site' }),
    },
  },
});

addResponseComponentFor('Site', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', format: 'int32' },
        },
      },
    },
  },
});

const CreateSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'Site' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'Site' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const CreateSitePath = OpenApiDefinition.path(CreateSiteOperation);
