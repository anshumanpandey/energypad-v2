import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessFloor',
  schema: {
    required: ['size', 'area', 'population'],
    properties: {
      size: { type: 'string' },
      area: { type: 'number', format: 'int32' },
      population: { type: 'number', format: 'int32' },
    },
  },
});
