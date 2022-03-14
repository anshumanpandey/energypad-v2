import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'FuelUse',
  schema: {
    required: ['use'],
    properties: {
      use: {
        type: 'string',
      },
    },
  },
});
