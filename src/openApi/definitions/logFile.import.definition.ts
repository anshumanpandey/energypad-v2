import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('LogFileImport', {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        properties: {
          excel: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
    'application/json': {
      schema: {
        readOnly: true,
        deprecated: true,
        type: 'string',
        format: 'binary',
      },
    },
  },
});

addResponseComponentFor('LogFileImport', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const LogFileImport: OpenAPIV3.OperationObject = {
  description: 'Import excel file.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'LogFileImport' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'LogFileImport' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const LogFileImportPath = OpenApiDefinition.path(LogFileImport);
