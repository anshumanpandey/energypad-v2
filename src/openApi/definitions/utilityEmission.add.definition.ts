import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
  CreateSchemaParams,
  createSchema,
} from '../OpenApiDefinition';

const bodySchema: CreateSchemaParams = {
  name: 'AddFuelSourceEmissionBody',
  schema: {
    required: [
      'emissionFactor',
      'kwhConversionFactor',
      'conversionFactor',
      'totalCost',
      'year',
      'month',
      'siteId',
      'fuelSourceId',
      'usedInId',
      'vat',
    ],
    properties: {
      emissionFactor: { type: 'number', format: 'int32' },
      kwhConversionFactor: { type: 'number', format: 'int32' },
      conversionFactor: { type: 'number', format: 'int32' },
      totalCost: { type: 'number', format: 'int32' },
      year: { type: 'number', format: 'int32' },
      month: { type: 'number', format: 'int32' },
      vat: { type: 'number', format: 'int32' },

      siteId: { type: 'number', format: 'int32' },
      fuelSourceId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
    },
  },
};
createSchema(bodySchema);

addRequestComponentFor('AddFuelSourceEmission', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'AddFuelSourceEmissionBody' }),
      },
    },
  },
});

const schema: CreateSchemaParams = {
  name: 'UtilityEmission',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'AddFuelSourceEmissionBody' }),
      {
        required: ['id'],
        properties: {
          id: { type: 'number', format: 'int32', readOnly: true },
        },
      },
    ],
  },
};
createSchema(schema);

addResponseComponentFor('AddFuelSourceEmission', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const AddUtilityEmission: OpenAPIV3.OperationObject = {
  description: 'Add emision to utility.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'AddFuelSourceEmission' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddFuelSourceEmission' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddUtilityEmissionPath = OpenApiDefinition.path(AddUtilityEmission);
