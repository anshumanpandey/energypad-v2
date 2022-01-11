import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('AddLog', {
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'EnergyLog' }),
    },
  },
});

addResponseComponentFor('AddLog', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const AddBusinessLog: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SaveBusinessEnergy' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddLog' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddBusinessLogPath = OpenApiDefinition.path(AddBusinessLog);
