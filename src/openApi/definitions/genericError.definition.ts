import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'GenericError',
  schema: {
    required: ['statusCode', 'message'],
    properties: {
      statusCode: {
        type: 'number',
      },
      message: {
        type: 'string',
      },
    },
  },
};

createSchema(schema);
