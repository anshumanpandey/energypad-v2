import { createSchema, getReferenceFor } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessEnergy',
  schema: {
    required: ['fuelSourceId', 'usedInId', 'brands', 'meternumbers', 'cost'],
    properties: {
      fuelSourceId: {
        type: 'number',
      },
      usedInId: {
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
});
