import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const siteBodySchema: CreateSchemaParams = {
  name: 'Site',
  schema: {
    required: ['type', 'address', 'postCode', 'town', 'population', 'size', 'fuel', 'uses', 'id', 'businessId'],
    properties: {
      type: { type: 'string' },
      address: { type: 'string' },
      postCode: { type: 'string' },
      town: { type: 'string' },
      population: { type: 'number', format: 'int32' },
      size: { type: 'number', format: 'int32' },
      fuel: { type: 'string' },
      uses: { type: 'string' },
      id: { type: 'number', readOnly: true },
      businessId: { type: 'number', readOnly: true },
    },
  },
};

createSchema(siteBodySchema);
