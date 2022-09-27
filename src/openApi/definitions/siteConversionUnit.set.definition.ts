import { OpenAPIV3 } from 'openapi-types';
import { SupportedUnits } from '../../utils/unitsUtils';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SetSiteConversionUnit', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          required: ['unitType', 'unitValue'],
          properties: {
            unitValue: { type: 'number', format: 'float' },
            unitType: { type: 'string', enum: SupportedUnits },
          },
        },
      },
    },
  },
});

addResponseComponentFor('SetSiteConversionUnit', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const SetSiteConversionUnit: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SetSiteConversionUnit' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SetSiteConversionUnit' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const SetSiteConversionUnitPath = OpenApiDefinition.path(SetSiteConversionUnit);
