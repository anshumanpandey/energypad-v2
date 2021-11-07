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
