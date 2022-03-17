import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetPatterns', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessPattern' }),
      },
    },
  },
});

const GetPatterns: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [{ in: 'query', name: 'siteId', schema: { type: 'string' }, required: false }],

  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetPatterns' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetPatternsPath = OpenApiDefinition.path(GetPatterns);
