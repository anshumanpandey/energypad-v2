import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
  addParameterComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('AddUtilityEmission', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'consumption', 'cost'],
        properties: {
          date: { type: 'string', format: 'date' },
          consumption: { type: 'number', format: 'int32' },
          cost: { type: 'number', format: 'int32' },
        },
      },
    },
  },
});

addResponseComponentFor('AddUtilityEmission', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

addParameterComponentFor('AddUtilityEmission', {
  name: 'utilityId',
  in: 'path',
  required: true,
  schema: {
    type: 'number',
  },
});

const AddUtilityEmission: OpenAPIV3.OperationObject = {
  description: 'Add emision to utility.',
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'CreateUtility' })],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddUtilityEmission' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const AddUtilityPath = OpenApiDefinition.path(AddUtilityEmission);
