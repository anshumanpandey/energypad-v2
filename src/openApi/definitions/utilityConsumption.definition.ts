import { createSchema, CreateSchemaParams, getReferenceFor } from '../OpenApiDefinition';

const schema: CreateSchemaParams = {
  name: 'UtilityConsumption',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'AddFuelSourceConsumptionBody' }),
      {
        required: ['id', 'fuelSourceName'],
        properties: {
          id: { type: 'number', format: 'int32', readOnly: true },
          fuelSourceName: { type: 'string' },
        },
      },
    ],
  },
};
createSchema(schema);
