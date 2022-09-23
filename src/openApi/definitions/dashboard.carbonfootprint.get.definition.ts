import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetDashboardCarbonFootprint', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['carbonEmissions'],
        additionalProperties: false,
        properties: {
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
        },
      },
    },
  },
});

const GetDashboardCarbonFootprint: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [
    { in: 'query', name: 'year', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'siteId', schema: { type: 'string' }, required: true },
    { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] }, required: false },
    { in: 'query', name: 'fuelSourceId', schema: { type: 'string' }, required: true, explode: true },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetDashboardCarbonFootprint' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetDashboardCarbonFootprintPath = OpenApiDefinition.path(GetDashboardCarbonFootprint);
