import { addResponseComponentFor, createSchema, CreateSchemaParams, getReferenceFor } from '../OpenApiDefinition';

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

addResponseComponentFor('GenericError', {
  description: 'Error message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'GenericError' }),
    },
  },
});
