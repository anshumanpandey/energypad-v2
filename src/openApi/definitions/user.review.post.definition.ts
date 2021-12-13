import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SetReviews', {
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'Review' }),
      },
    },
  },
});

addResponseComponentFor('SetReviews', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const SetBusinessReview: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SaveBusinessEnergy' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SetReviews' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const SetBusinessReviewPath = OpenApiDefinition.path(SetBusinessReview);
