import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
  CreateSchemaParams,
  createSchema,
} from '../OpenApiDefinition';

const utilityBodySchema: CreateSchemaParams = {
  name: 'Utility',
  schema: {
    required: ['name', 'id'],
    properties: {
      id: { type: 'number', readOnly: true },
      name: { type: 'string' },
    },
  },
};

createSchema(utilityBodySchema);

addRequestComponentFor('CreateUtility', {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
    },
  },
});

addResponseComponentFor('CreateUtility', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const CreateUtilityOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new utility.',
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'CreateUtility' })],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'CreateUtility' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const CreateUtilityPath = OpenApiDefinition.path(CreateUtilityOperation);
