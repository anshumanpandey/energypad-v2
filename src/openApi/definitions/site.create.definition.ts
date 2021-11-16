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
      schema: getReferenceFor({ for: 'schemas', name: 'SiteRequestBody' }),
    },
  },
});

addResponseComponentFor('Site', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const CreateSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ BearerAuth: [] }],
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'Site' })],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'Site' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const CreateSitePath = OpenApiDefinition.path(CreateSiteOperation);
