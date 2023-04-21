import { UnitsUtil } from '@utils';
import { OpenAPIV3 } from 'openapi-types';
import { SupportedUnits } from '../../utils/unitsUtils';
import { OpenApiDefinition, getReferenceFor, addResponseComponentFor } from '../OpenApiDefinition';

addResponseComponentFor('GetConversionUnit', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          required: ['unit', 'value'],
          properties: {
            value: { type: 'number' },
            unit: { type: 'string', enum: SupportedUnits },
          },
        },
      },
    },
  },
});

const GetConversionUnit: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'fuelSource',
      schema: {
        type: 'array',
        items: {
          type: 'string',
          enum: Object.keys(UnitsUtil.ConversionValues),
        },
      },
      required: false,
    },
  ],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'GetConversionUnit' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const GetConversionUnitPath = OpenApiDefinition.path(GetConversionUnit);
