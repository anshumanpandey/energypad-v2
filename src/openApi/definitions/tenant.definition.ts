import { createSchema, CreateSchemaParams } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'Tenant',
  schema: {
    required: ['siteId', 'usedInId', 'date', 'regularTenantAmount', 'irregularTenantAmount'],
    properties: {
      siteId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
      date: { type: 'string', format: 'date' },
      regularTenantAmount: { type: 'number', format: 'int32' },
      irregularTenantAmount: { type: 'number', format: 'int32' },
    },
  },
};

createSchema(schema);
