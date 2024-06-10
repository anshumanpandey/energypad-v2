import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetMonitoring', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'ConsumptionTarget' }),
      },
    },
  },
});

const GetMonitoring: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: false },
    { in: 'query', name: 'year', schema: { type: 'string' }, required: false },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetMonitoring' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetMonitoringPath = OpenApiDefinition.path(GetMonitoring);
