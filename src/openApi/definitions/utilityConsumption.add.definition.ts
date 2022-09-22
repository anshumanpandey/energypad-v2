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
  name: 'AddFuelSourceConsumptionBody',
  schema: {
    required: ['date', 'consumption', 'cost', 'siteId', 'fuelSourceId'],
    properties: {
      date: { type: 'string', format: 'date' },
      consumption: { type: 'number', format: 'int32' },
      cost: { type: 'number', format: 'int32' },
      conversionUnit: { type: 'string' },
      siteId: { type: 'number', format: 'int32' },
      fuelSourceId: { type: 'number', format: 'int32' },
    },
  },
};
createSchema(bodySchema);

addRequestComponentFor('AddFuelSourceConsumption', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'AddFuelSourceConsumptionBody' }),
      },
    },
  },
});

addResponseComponentFor('AddFuelSourceConsumption', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
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
