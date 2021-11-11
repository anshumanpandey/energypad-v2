import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getReferenceFor,
} from '../OpenApiDefinition';

addRequestComponentFor('Site', {
  required: true,
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SiteRequestBody' }),
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
  security: [{ BearerAuth: [] }],
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

export const CreateSitePath = OpenApiDefinition.path(CreateSiteOperation);
