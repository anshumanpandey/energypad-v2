import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'SavingTip',
  schema: {
    required: ['category', 'text', 'id'],
    properties: {
      id: { type: 'number', readOnly: true },
      category: { type: 'string' },
      text: { type: 'string' },
      imageUrl: { type: 'string', nullable: true },
    },
  },
});
