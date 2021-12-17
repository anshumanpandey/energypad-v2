import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SetFloors', {
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessFloor' }),
      },
    },
  },
});

addResponseComponentFor('SetFloors', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const SetBusinessSetFloors: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SetFloors' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SetFloors' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const SetBusinessSetFloorsPath = OpenApiDefinition.path(SetBusinessSetFloors);
