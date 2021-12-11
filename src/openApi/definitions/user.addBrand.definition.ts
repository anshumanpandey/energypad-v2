import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SetBrands', {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['brands'],
        properties: {
          brands: {
            type: 'array',
            items: getReferenceFor({ for: 'schemas', name: 'Brand' }),
          },
        },
      },
    },
  },
});

addResponseComponentFor('SetBrands', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const AddBrandToBusinessOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SetBrands' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SetBrands' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddBrandToBusinessPath = OpenApiDefinition.path(AddBrandToBusinessOperation);
