import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetSites', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'Site' }),
      },
    },
  },
});

const GetBusinessSites: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetSites' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetBusinessSitesPath = OpenApiDefinition.path(GetBusinessSites);
