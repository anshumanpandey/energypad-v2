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
  name: 'AddUtilityConsumptionBody',
  schema: {
    required: ['date', 'consumption', 'cost', 'usedInId', 'siteId'],
    properties: {
      date: { type: 'string', format: 'date' },
      consumption: { type: 'number', format: 'int32' },
      cost: { type: 'number', format: 'int32' },
      siteId: { type: 'number', format: 'int32' },
      usedInId: { type: 'number', format: 'int32' },
    },
  },
};
createSchema(bodySchema);

addRequestComponentFor('AddUtilityConsumption', {
  required: true,
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'AddUtilityConsumptionBody' }),
    },
  },
});

const schema: CreateSchemaParams = {
  name: 'UtilityConsumption',
  schema: {
    allOf: [
      getReferenceFor({ for: 'schemas', name: 'AddUtilityConsumptionBody' }),
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

addResponseComponentFor('AddUtilityConsumption', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

addParameterComponentFor('AddUtilityConsumption', {
  name: 'utilityId',
  in: 'path',
  required: true,
  schema: {
    type: 'number',
  },
});

const AddUtilityConsumption: OpenAPIV3.OperationObject = {
  description: 'Add emision to utility.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'AddUtilityConsumption' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddUtilityConsumption' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddUtilityConsumptionPath = OpenApiDefinition.path(AddUtilityConsumption);
