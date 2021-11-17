import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('UpdateUser', {
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'RegisterBody' }),
    },
  },
});

addResponseComponentFor('UpdateUser', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const UpdateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  parameters: [getReferenceFor({ for: 'requestBodies', name: 'UpdateUser' })],
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'UpdateUser' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const UpdateUserPath = OpenApiDefinition.path(UpdateUserOperation);
