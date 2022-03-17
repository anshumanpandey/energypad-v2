import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetConsumptions', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'UtilityConsumption' }),
      },
    },
  },
});

const GetConsumptions: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: false },
    { in: 'query', name: 'year', schema: { type: 'string' }, required: false },
    { in: 'query', name: 'month', schema: { type: 'string' }, required: false },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetConsumptions' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetConsumptionsPath = OpenApiDefinition.path(GetConsumptions);
