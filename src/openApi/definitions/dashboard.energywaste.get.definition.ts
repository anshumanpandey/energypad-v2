import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetDashboardEnergyWaste', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['energyTargets'],
        additionalProperties: false,
        properties: {
          energyTargets: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['date', 'projectedEnergy', 'consumption', 'saving', 'siteId'],
              properties: {
                date: { type: 'string', format: 'date' },
                projectedEnergy: { type: 'number', format: 'int32' },
                consumption: { type: 'number', format: 'int32' },
                saving: { type: 'number' },
                siteId: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
});

const GetDashboardEnergyWaste: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'year', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'month', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'fuelSourceId', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: true },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetDashboardEnergyWaste' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetDashboardEnergyWastePath = OpenApiDefinition.path(GetDashboardEnergyWaste);
