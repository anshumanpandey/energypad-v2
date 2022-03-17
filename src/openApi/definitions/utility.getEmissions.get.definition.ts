import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetEmissions', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'UtilityEmission' }),
      },
    },
  },
});

const GetEmissions: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: false },
    { in: 'query', name: 'year', schema: { type: 'string' }, required: false },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetEmissions' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetEmissionsPath = OpenApiDefinition.path(GetEmissions);
