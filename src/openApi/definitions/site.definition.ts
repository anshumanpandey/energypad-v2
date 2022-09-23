import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const siteBodySchema: CreateSchemaParams = {
  name: 'Site',
  schema: {
    required: ['type', 'address', 'postCode', 'town', 'population', 'size', 'workinghours', 'fullTimeEmployee'],
    properties: {
      type: { type: 'string' },
      address: { type: 'string' },
      postCode: { type: 'string' },
      town: { type: 'string' },
      population: { type: 'number', format: 'int32' },
      size: { type: 'number', format: 'int32' },
      workinghours: { type: 'number', format: 'int32' },
      fullTimeEmployee: { type: 'boolean', format: 'int32' },
    },
  },
};

createSchema(siteBodySchema);
