import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetUser', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'User' }),
    },
  },
});

const GetUser: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetUser' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetUserPath = OpenApiDefinition.path(GetUser);
