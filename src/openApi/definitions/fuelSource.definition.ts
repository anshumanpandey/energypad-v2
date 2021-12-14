import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'FuelSource',
  schema: {
    required: ['source', 'usedIn'],
    properties: {
      source: { type: 'string' },
      usedIn: {
        type: 'array',
        items: {
          type: 'string',
          additionalProperties: false,
        },
      },
    },
  },
});
