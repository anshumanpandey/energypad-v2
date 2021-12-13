import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'Programme',
  schema: {
    required: ['question', 'answers', 'siteId', 'usedInId'],
    properties: {
      question: { type: 'string' },
      siteId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
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
