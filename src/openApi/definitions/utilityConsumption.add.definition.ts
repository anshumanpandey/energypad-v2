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
    required: [
      'date',
      'totalCost',
      'consumption',
      'vat',
      'fuelUnit',
      'siteId',
      'fuelSourceId',
      'usedInId',
      'conversionFactor',
    ],
    properties: {
      date: { type: 'string', format: 'date' },
      consumption: { type: 'number', format: 'float' },
      totalCost: { type: 'number', format: 'float' },
      conversionFactor: { type: 'number', format: 'float' },
      fuelUnit: { type: 'string' },
      vat: { type: 'number', format: 'float' },
      siteId: { type: 'number', format: 'int32' },
      fuelSourceId: { type: 'number', format: 'int32' },
      usedInId: {
        type: 'number',
        format: 'int32',
      },
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
