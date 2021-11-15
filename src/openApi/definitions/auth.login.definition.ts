import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  addResponseComponentFor,
  getReferenceFor,
} from '../OpenApiDefinition';

addRequestComponentFor('Login', {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', transform: ['trim'] },
          password: { type: 'string', transform: ['trim'] },
        },
      },
    },
  },
});

addResponseComponentFor('Login', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'JWTToken' }),
    },
  },
});

const LoginOperation: OpenAPIV3.OperationObject = {
  description: 'Return JWT token.',
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'Login' })],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'Login' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const LoginPath = OpenApiDefinition.path(LoginOperation);
