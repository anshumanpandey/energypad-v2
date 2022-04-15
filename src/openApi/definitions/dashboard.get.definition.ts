import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetDashboardData', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['consumptions', 'energyTargets'],
        additionalProperties: false,
        properties: {
          consumptions: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['date', 'averageConsumption', 'averageCost', 'consumption', 'increasedConsumptionPercentage'],
              properties: {
                date: { type: 'string', format: 'date' },
                averageConsumption: { type: 'number', format: 'int32' },
                averageCost: { type: 'number', format: 'int32' },
                consumption: { type: 'number', format: 'int32' },
                cost: { type: 'number', format: 'int32' },
                increasedConsumptionPercentage: { type: 'number' },
                increasedCostPercentage: { type: 'number' },
              },
            },
          },
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
          consumptionsDetails: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['date', 'fuelSourceName', 'incesedPercentage', 'consumption'],
              properties: {
                date: { type: 'string', format: 'date' },
                fuelSourceName: { type: 'string' },
                incesedPercentage: { type: 'number' },
                consumption: { type: 'number', format: 'int32' },
              },
            },
          },
        },
      },
    },
  },
});

const GetDashboardData: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'year', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'fuelSourceId', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: true },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetDashboardData' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetDashboardDataPath = OpenApiDefinition.path(GetDashboardData);
