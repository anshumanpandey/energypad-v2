import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetUsedIn', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'FuelUse' }),
      },
    },
  },
});

const GetUsedIn: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetUsedIn' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetUsedInPath = OpenApiDefinition.path(GetUsedIn);
