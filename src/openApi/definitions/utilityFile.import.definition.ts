import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('UtilityFileImport', {
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

addResponseComponentFor('UtilityFileImport', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const UtilityFileImport: OpenAPIV3.OperationObject = {
  description: 'Import excel file.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'UtilityFileImport' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'UtilityFileImport' }),
    '400': getReferenceFor({ for: 'schemas', name: 'GenericError' }),
  },
};

export const UtilityFileImportPath = OpenApiDefinition.path(UtilityFileImport);
