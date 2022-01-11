import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'EnergyLog',
  schema: {
    required: ['siteId', 'usedInId', 'operation', 'comments', 'startDate', 'endDate'],
    properties: {
      siteId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
      operation: { type: 'string' },
      comments: { type: 'string' },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
    },
  },
});
