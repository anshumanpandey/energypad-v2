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
    required: ['emissionFactor', 'conversionFactor', 'fuelUnit', 'date', 'siteId', 'fuelSourceId', 'usedInId'],
    properties: {
      emissionFactor: { type: 'number', format: 'int32' },
      conversionFactor: { type: 'number', format: 'int32' },
      date: { type: 'string', format: 'date' },
      fuelUnit: { type: 'string' },

      siteId: { type: 'number', format: 'int32' },
      fuelSourceId: { type: 'number', format: 'int32' },
      usedInId: {
        type: 'array',
        items: { type: 'number', format: 'int32' },
      },
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
