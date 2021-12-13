import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessBrand',
  schema: {
    required: ['name', 'startTime', 'endTime', 'days', 'rate'],
    properties: {
      name: { type: 'string' },
      rate: { type: 'number' },
      startTime: { type: 'string', format: 'time' },
      endTime: { type: 'string', format: 'time' },
      days: {
        type: 'array',
        items: {
          type: 'string',
          additionalProperties: true,
        },
      },
    },
  },
});
