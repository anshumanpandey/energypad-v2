import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  getReferenceFor,
  addResponseComponentFor,
  addParameterComponentFor,
} from '../OpenApiDefinition';

addResponseComponentFor('GetSiteDetails', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['programmes', 'reviews', 'tenants', 'logs', 'energies'],
        properties: {
          programmes: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'Programme' }),
          },
          reviews: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'Review' }),
          },
          tenants: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'Tenant' }),
          },
          logs: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'EnergyLog' }),
          },
          energies: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'BusinessEnergy' }),
          },
        },
      },
    },
  },
});

addParameterComponentFor('GetSiteDetails', {
  name: 'siteId',
  in: 'path',
  required: true,
  schema: {
    type: 'number',
  },
});

const GetSiteDetails: OpenAPIV3.OperationObject = {
  description: 'Get dashboard data per date.',
  parameters: [],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetSiteDetails' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetSiteDetailsPath = OpenApiDefinition.path(GetSiteDetails);
