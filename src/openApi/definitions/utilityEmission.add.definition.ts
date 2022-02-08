import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
  addParameterComponentFor,
  CreateSchemaParams,
  createSchema,
} from '../OpenApiDefinition';

const bodySchema: CreateSchemaParams = {
  name: 'AddFuelSourceEmissionBody',
  schema: {
    required: ['emissionFactor', 'value', 'year', 'siteId'],
    properties: {
      emissionFactor: { type: 'string' },
      value: { type: 'number', format: 'int32' },
      year: { type: 'number', format: 'int32' },
      siteId: { type: 'number', format: 'int32' },
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

addParameterComponentFor('AddFuelSourceEmission', {
  name: 'utilityId',
  in: 'path',
  required: true,
  schema: {
    type: 'number',
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
