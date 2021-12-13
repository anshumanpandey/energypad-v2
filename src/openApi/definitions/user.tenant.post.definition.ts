import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SetTenants', {
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'Tenant' }),
      },
    },
  },
});

addResponseComponentFor('SetTenants', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const SetBusinessTenant: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SaveBusinessEnergy' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SetTenants' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const SetBusinessTenantPath = OpenApiDefinition.path(SetBusinessTenant);
