import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('DeleteSite', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'number',
            format: 'int32',
          },
        },
      },
    },
  },
});

addResponseComponentFor('DeleteSite', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const DeleteSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'DeleteSite' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'DeleteSite' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const DeleteSitePath = OpenApiDefinition.path(DeleteSiteOperation);
