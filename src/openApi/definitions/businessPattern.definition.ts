import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessPattern',
  schema: {
    required: ['startDate', 'endDate', 'temperature', 'daysOnYear', 'siteId', 'usedInId'],
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      temperature: { type: 'number', format: 'int32' },
      daysOnYear: { type: 'number', format: 'int32' },
      siteId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
    },
  },
});
