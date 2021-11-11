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
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  },
});

addResponseComponentFor('Login', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        oneOf: [
          getReferenceFor({ for: 'schemas', name: 'JWTToken' }),
          getReferenceFor({ for: 'schemas', name: 'GenericError' }),
        ],
      },
    },
  },
});

const LoginOperation: OpenAPIV3.OperationObject = {
  description: 'Return JWT token.',
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'Login' })],
  responses: {
    '200': {
      description: 'Success message',
      content: {
        'application/json': {
          schema: getReferenceFor({ for: 'responses', name: 'Login' }),
        },
      },
    },
  },
};

export const LoginPath = OpenApiDefinition.path(LoginOperation);
