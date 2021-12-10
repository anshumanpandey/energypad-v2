import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'Programme',
  schema: {
    required: ['question', 'utilityId', 'answers'],
    properties: {
      question: { type: 'string' },
      utilityId: { type: 'number', readOnly: true },
      answers: {
        type: 'array',
        items: {
          type: 'string',
          additionalProperties: true,
        },
      },
    },
  },
});
