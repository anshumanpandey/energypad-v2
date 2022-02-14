import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SaveBusinessPattern', {
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessPattern' }),
      },
    },
  },
});

addResponseComponentFor('SaveBusinessPattern', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const SetBusinessPatternsOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SaveBusinessPattern' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SaveBusinessPattern' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const SetBusinessPatternsPath = OpenApiDefinition.path(SetBusinessPatternsOperation);
