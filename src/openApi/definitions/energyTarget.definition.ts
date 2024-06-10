import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'ConsumptionTarget',
  schema: {
    required: ['energy', 'carbon', 'conversionFactor', 'fuelUnit', 'date', 'siteId', 'fuelSourceId'],
    properties: {
      id: { type: 'number', format: 'int32' },
      energy: { type: 'number', format: 'int32' },
      carbon: { type: 'number', format: 'int32' },
      conversionFactor: { type: 'number', format: 'int32' },
      fuelUnit: { type: 'string', format: 'int32' },
      date: { type: 'string', format: 'int32' },
      siteId: { type: 'number', format: 'int32' },
      fuelSourceId: { type: 'number', format: 'int32' },
    },
  },
});
