import { createSchema, CreateSchemaParams, getReferenceFor } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'User',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'RegisterBody' }),
      {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: {
          id: {
            type: 'number',
          },
        },
      },
    ],
  },
};

createSchema(schema);
