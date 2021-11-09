import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'SuccessMessage',
  schema: {
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
      },
    },
  },
};

createSchema(schema);
