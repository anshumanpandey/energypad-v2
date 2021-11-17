import { createSchema } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessService',
  schema: {
    required: ['startDate', 'endDate', 'consumption', 'daysOnYear'],
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      consumption: { type: 'number', format: 'int32' },
      daysOnYear: { type: 'number', format: 'int32' },
    },
  },
});
