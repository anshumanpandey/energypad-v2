import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessCost',
  schema: {
    required: ['currencyCode', 'vat'],
    properties: {
      currencyCode: { type: 'string' },
      vat: { type: 'number', format: 'int32' },
    },
  },
});
