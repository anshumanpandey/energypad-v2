import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SiteUpdate', {
  required: true,
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'Site' }),
    },
  },
});

addResponseComponentFor('SiteUpdate', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const UpdateSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SiteUpdate' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SiteUpdate' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const UpdateSitePath = OpenApiDefinition.path(UpdateSiteOperation);
