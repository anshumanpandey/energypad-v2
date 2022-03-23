import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('FileImportBusinessTenants', {
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

addResponseComponentFor('FileImportBusinessTenants', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const FileImportBusinessTenants: OpenAPIV3.OperationObject = {
  description: 'Import excel file.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'FileImportBusinessTenants' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'FileImportBusinessTenants' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const FileImportBusinessTenantsPath = OpenApiDefinition.path(FileImportBusinessTenants);
