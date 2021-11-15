import { createSchema, CreateSchemaParams, getReferenceFor } from '../OpenApiDefinition';

const siteBodySchema: CreateSchemaParams = {
  name: 'SiteRequestBody',
  schema: {
    required: ['type', 'address', 'postCode', 'town', 'population', 'size', 'fuel', 'uses'],
    properties: {
      type: { type: 'string' },
      address: { type: 'string' },
      postCode: { type: 'string' },
      town: { type: 'number', format: 'int32' },
      population: { type: 'number', format: 'int32' },
      size: { type: 'number', format: 'int32' },
      fuel: { type: 'string' },
      uses: { type: 'string' },
    },
  },
};

createSchema(siteBodySchema);

const schema: CreateSchemaParams = {
  name: 'Site',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'SiteRequestBody' }),
      {
        required: ['id', 'businessId'],
        properties: {
          id: { type: 'number', readOnly: true },
          businessId: { type: 'string', readOnly: true },
        },
      },
    ],
  },
};
createSchema(schema);
