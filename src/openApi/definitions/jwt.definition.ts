import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'JWTToken',
  schema: {
    required: ['jwt'],
    properties: {
      jwt: {
        type: 'string',
      },
    },
  },
};

createSchema(schema);
