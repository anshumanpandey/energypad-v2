import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

addRequestComponentFor('SiteUpdate', {
  required: true,
  content: {
    'application/json': {
      schema: {
        required: ['id', 'name', 'type', 'address', 'postCode', 'town', 'population', 'size', 'workinghours'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          code: { type: 'string' },
          type: { type: 'string' },
          address: { type: 'string' },
          postCode: { type: 'string' },
          town: { type: 'string' },
          population: { type: 'number', format: 'int32' },
          size: { type: 'number', format: 'int32' },
          workinghours: { type: 'number', format: 'int32' },
          fullTimeEmployee: { type: 'boolean' },
          countryId: { type: 'number', format: 'int32' },
          stateId: { type: 'number', format: 'int32' },
        },
      },
    },
  },
});

addResponseComponentFor('SiteUpdate', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const UpdateSiteOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new site for a business.',
  security: [{ bearer: [] }],
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'SiteUpdate' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'SiteUpdate' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const UpdateSitePath = OpenApiDefinition.path(UpdateSiteOperation);
