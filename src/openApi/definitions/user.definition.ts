import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'User',
  schema: {
    required: ['name'],
    properties: {
      name: {
        type: 'string',
      },
    },
  },
};

createSchema(schema);
