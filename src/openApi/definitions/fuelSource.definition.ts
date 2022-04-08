import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'FuelSource',
  schema: {
    required: ['source', 'usedIn', 'colorCode'],
    properties: {
      source: { type: 'string' },
      colorCode: { type: 'string' },
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
