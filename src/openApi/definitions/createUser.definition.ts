import { OpenApiDefinition } from '../OpenApiDefinition';
import UserSchema from './user.definition';

OpenApiDefinition.component('requestBodies', 'CreateUser', {
  description: 'User to add to the system',
  content: {
    'application/json': {
      schema: UserSchema,
    },
  },
});

OpenApiDefinition.component('responses', 'CreateUser', {
  description: 'User to add to the system',
  content: {
    'application/json': {
      schema: {
        type: 'object',
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
