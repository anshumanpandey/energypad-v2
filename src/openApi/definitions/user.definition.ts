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
            readOnly: true,
          },
          floors: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['size', 'area', 'population'],
              properties: {
                size: { type: 'string' },
                area: { type: 'number', format: 'int32' },
                population: { type: 'number', format: 'int32' },
              },
            },
          },
          patterns: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'BusinessPattern' }),
          },
        },
      },
    ],
  },
};

createSchema(schema);
