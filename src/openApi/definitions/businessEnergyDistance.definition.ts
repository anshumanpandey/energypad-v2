import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessDistance',
  schema: {
    required: ['meters'],
    properties: {
      meters: { type: 'string' },
    },
  },
});
