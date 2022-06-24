import { OpenAPIV3 } from 'openapi-types';
import {
  OpenApiDefinition,
  addRequestComponentFor,
  getReferenceFor,
  createSchema,
  addResponseComponentFor,
} from '../OpenApiDefinition';

const registerBodyRequiredProperties = [
  'businessName',
  'businessType',
  'businessService',
  'siteName',
  'buildingName',
  'contactName',
  'position',
  'phoneNumber',
  'email',
  'countryId',
  'stateId',
  'town',
  'postCode',
  'subscriptionDate',
];
createSchema({
  name: 'RegisterBody',
  schema: {
    additionalProperties: true,
    required: registerBodyRequiredProperties,
    properties: {
      businessName: { type: 'string' },
      businessType: { type: 'string' },
      businessService: { type: 'string' },
      siteName: { type: 'string' },
      buildingName: { type: 'string' },
      contactName: { type: 'string' },
      position: { type: 'string' },
      phoneNumber: { type: 'string' },
      email: { type: 'string', transform: ['trim'] },
      countryId: { type: 'number', format: 'int32' },
      stateId: { type: 'number', format: 'int32' },
      town: { type: 'string' },
      postCode: { type: 'string' },
      subscriptionDate: { type: 'string', format: 'date' },
      holydayDate: { type: 'string' },
      totalArea: { type: 'number', format: 'int32' },
      totalPopulation: { type: 'number', format: 'int32' },
      floors: {
        type: 'array',
        items: getReferenceFor({ for: 'schemas', name: 'BusinessFloor' }),
      },
    },
  },
});

addRequestComponentFor('Register', {
  content: {
    'application/json': {
      schema: {
        //TODO: dont allow additionalProperties
        additionalProperties: true,
        allOf: [getReferenceFor({ for: 'schemas', name: 'RegisterBody' })],
        required: registerBodyRequiredProperties.concat(['password']),
        properties: {
          password: { type: 'string', transform: ['trim'], writeOnly: true },
        },
      },
    },
  },
});

addResponseComponentFor('Register', {
  description: 'Success message',
  content: {
    'application/json': {
      schema: getReferenceFor({ for: 'schemas', name: 'SuccessMessage' }),
    },
  },
});

const CreateUserOperation: OpenAPIV3.OperationObject = {
  description: 'Create a new user.',
  requestBody: getReferenceFor({ for: 'requestBodies', name: 'Register' }),
  responses: {
    '200': getReferenceFor({ for: 'responses', name: 'Register' }),
    '400': getReferenceFor({ for: 'responses', name: 'GenericError' }),
  },
};

export const RegisterPath = OpenApiDefinition.path(CreateUserOperation);
