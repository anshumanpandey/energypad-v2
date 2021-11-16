import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetDashboardData', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          additionalProperties: false,
          properties: {
            date: { type: 'string', format: 'date' },
            avarage: { type: 'number', format: 'int32' },
          },
        },
      },
    },
  },
});

const GetDashboardData: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetDashboardData' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetDashboardDataPath = OpenApiDefinition.path(GetDashboardData);
