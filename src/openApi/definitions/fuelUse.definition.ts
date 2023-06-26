import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'FuelUse',
  schema: {
    required: ['use', 'id'],
    properties: {
      use: {
        type: 'string',
      },
      id: {
        type: 'number',
        readOnly: true,
      },
    },
  },
});
