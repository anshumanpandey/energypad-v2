import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetFuelSources', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          allOf: [
            getReferenceFor({ for: 'schemas', name: 'FuelSource' }),
            { required: ['id'], properties: { id: { type: 'number' } } },
          ],
        },
      },
    },
  },
});

const GetFuelSources: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetFuelSources' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetFuelSourcesPath = OpenApiDefinition.path(GetFuelSources);
