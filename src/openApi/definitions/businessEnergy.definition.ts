import { createSchema, getReferenceFor } from '../OpenApiDefinition';

createSchema({
  name: 'BusinessEnergy',
  schema: {
    required: ['usedInId', 'siteId', 'brands', 'distance', 'cost'],
    properties: {
      usedInId: {
        type: 'number',
      },
      siteId: {
        type: 'number',
      },
      brands: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessBrand' }),
      },
      distance: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessDistance' }),
      },
      cost: getReferenceFor({ for: 'schemas', name: 'BusinessCost' }),
    },
  },
});
