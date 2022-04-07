import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetDashboardReports', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['energyTargets', 'reports', 'carbonEmissions'],
        additionalProperties: false,
        properties: {
          energyTargets: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['date', 'projectedEnergy', 'consumption'],
              properties: {
                date: { type: 'string', format: 'date' },
                projectedEnergy: { type: 'number', format: 'int32' },
                consumption: { type: 'number', format: 'int32' },
              },
            },
          },
          carbonEmissions: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['date', 'carbonEmission', 'carbonTarget'],
              properties: {
                date: { type: 'string', format: 'date' },
                carbonEmission: { type: 'number', format: 'int32' },
                carbonTarget: { type: 'number', format: 'int32' },
              },
            },
          },
          reports: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['id'],
              properties: {
                id: { type: 'number', format: 'int32' },
              },
            },
          },
        },
      },
    },
  },
});

const GetDashboardReports: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'year', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'fuelSourceId', schema: { type: 'string' }, required: false, explode: true },
    { in: 'query', name: 'month', schema: { type: 'string' }, required: false },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetDashboardReports' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetDashboardReportsPath = OpenApiDefinition.path(GetDashboardReports);
