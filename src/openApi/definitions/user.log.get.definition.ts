import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetLogs', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['logs', 'tenants'],
        properties: {
          logs: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'EnergyLog' }),
          },
          tenants: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'Tenant' }),
          },
        },
      },
    },
  },
});

const GetLogs: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'year', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'month', schema: { type: 'string' }, required: true },
  ],

  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetLogs' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetLogsPath = OpenApiDefinition.path(GetLogs);
