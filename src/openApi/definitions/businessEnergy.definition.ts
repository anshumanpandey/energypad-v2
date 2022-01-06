import { createSchema, getReferenceFor } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessEnergy',
  schema: {
    required: ['siteId', 'records'],
    properties: {
      siteId: {
        type: 'number',
      },
      records: {
        additionalProperties: false,
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fuelSourceId', 'brands', 'meternumbers', 'cost'],
          properties: {
            fuelSourceId: {
              type: 'number',
            },
            brands: {
              type: 'array',
              items: getReferenceFor({ for: 'schemas', name: 'BusinessBrand' }),
            },
            meternumbers: {
              type: 'array',
              items: getReferenceFor({ for: 'schemas', name: 'BusinessDistance' }),
            },
            cost: getReferenceFor({ for: 'schemas', name: 'BusinessCost' }),
          },
        },
      },
    },
  },
});
