import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetStates', {
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

const GetStates: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [{ in: 'query', name: 'countryId', schema: { type: 'string' }, required: false }],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetStates' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetStatesPath = OpenApiDefinition.path(GetStates);
