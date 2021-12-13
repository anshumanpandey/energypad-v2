import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'Review',
  schema: {
    required: ['question', 'answers', 'siteId'],
    properties: {
      question: { type: 'string' },
      siteId: { type: 'number', format: 'int32' },
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
