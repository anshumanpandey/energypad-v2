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
  name: 'AddFuelSourceConsumptionBody',
  schema: {
    required: ['date', 'consumption', 'cost'],
    properties: {
      date: { type: 'string', format: 'date' },
      consumption: { type: 'number', format: 'int32' },
      cost: { type: 'number', format: 'int32' },
    },
  },
};
createSchema(bodySchema);

addRequestComponentFor('AddFuelSourceConsumption', {
  required: true,
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'AddFuelSourceConsumptionBody' }),
    },
  },
});

const schema: CreateSchemaParams = {
  name: 'UtilityConsumption',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'AddFuelSourceConsumptionBody' }),
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

addResponseComponentFor('AddFuelSourceConsumption', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

addParameterComponentFor('AddFuelSourceConsumption', {
  name: 'utilityId',
  in: 'path',
  required: true,
  schema: {
    type: 'number',
  },
});

const AddUtilityConsumption: OpenAPIV3.OperationObject = {
  description: 'Add emision to utility.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'AddFuelSourceConsumption' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddFuelSourceConsumption' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddUtilityConsumptionPath = OpenApiDefinition.path(AddUtilityConsumption);
