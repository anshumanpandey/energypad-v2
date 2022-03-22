import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('FileImportBusiness', {
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

addResponseComponentFor('FileImportBusiness', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const FileImportBusiness: OpenAPIV3.OperationObject = {
  description: 'Import excel file.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'FileImportBusiness' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'FileImportBusiness' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const FileImportBusinessPath = OpenApiDefinition.path(FileImportBusiness);
