import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetCountries', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          required: ['id', 'name'],
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      },
    },
  },
});

const GetCountries: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetCountries' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetCountriesPath = OpenApiDefinition.path(GetCountries);
