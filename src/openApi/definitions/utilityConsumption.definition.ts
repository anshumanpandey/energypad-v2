import { createSchema, CreateSchemaParams, getReferenceFor } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'UtilityConsumption',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'AddFuelSourceConsumptionBody' }),
      {
        required: ['id', 'fuelSourceName', 'siteName', 'conversionUnit', 'usedIn', 'population', 'workingHours'],
        properties: {
          id: { type: 'number', format: 'int32', readOnly: true },
          fuelSourceName: { type: 'string' },
          siteName: { type: 'string' },
          usedIn: { type: 'string' },
          vatCost: { type: 'number' },
          population: { type: 'number' },
          workingHours: { type: 'number' },
        },
      },
    ],
  },
};
createSchema(schema);
