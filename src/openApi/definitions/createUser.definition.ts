import { OpenAPIV3 } from 'openapi-types';
import { OpenApiDefinition, getSchemaComponentFor } from '../OpenApiDefinition';

OpenApiDefinition.component('requestBodies', 'CreateUser', {
  description: 'User to add to the system',
  content: {
    'application/json': {
      schema: getSchemaComponentFor({ for: 'schemas', name: 'User' }),
    },
  },
});

OpenApiDefinition.component('responses', 'CreateUser', {
  description: 'User to add to the system',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['success'],
        properties: {
          success: {
            type: 'string',
          },
        },
      },
    },
  },
});

const CreateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Returns all pets from the system that the user has access to',
  parameters: [OpenApiDefinition.component('requestBodies', 'CreateUser')],
  responses: {
    '200': {
      description: 'A list of pets.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/responses/CreateUser',
          },
        },
      },
    },
  },
};

export const CreateUserPath = OpenApiDefinition.path(CreateUserOperation);
