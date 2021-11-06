import { OpenApiDefinition } from '../OpenApiDefinition';

OpenApiDefinition.component('schemas', 'User', {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
    },
  },
});

const UserSchema = OpenApiDefinition.component('schemas', 'User');

export default UserSchema;
