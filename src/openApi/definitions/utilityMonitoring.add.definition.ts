import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  addResponseComponentFor,
} from '../OpenApiDefinition';

const props: OpenAPIV3.SchemaObject['properties'] = {
  carbon: { type: 'number', format: 'int32' },
  conversionFactor: { type: 'number', format: 'int32' },
  energy: { type: 'number', format: 'int32' },
  date: { type: 'string', format: 'date' },
  fuelUnit: { type: 'string' },

  siteId: { type: 'number', format: 'int32' },
  fuelSourceId: { type: 'number', format: 'int32' },
  usedInId: {
    type: 'array',
    items: { type: 'number', format: 'int32' },
  },
};
addRequestComponentFor('AddFuelSourceMonitoring', {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: {
          required: Object.keys(props),
          properties: props,
        },
      },
    },
  },
});

addResponseComponentFor('AddFuelSourceMonitoring', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const AddUtilityMonitoring: OpenAPIV3.OperationObject = {
  description: 'Add emision to utility.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'AddFuelSourceMonitoring' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'AddFuelSourceMonitoring' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const AddUtilityMonitoringPath = OpenApiDefinition.path(AddUtilityMonitoring);
