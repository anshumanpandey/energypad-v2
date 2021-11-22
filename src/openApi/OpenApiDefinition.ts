//@ts-expect-error library does not include a typescript definition
import openapi from '@wesleytodd/openapi';
import { OpenAPIV3 } from 'openapi-types';

const OpenApi: Pick<OpenAPIV3.Document, 'openapi' | 'info' | 'servers' | 'security'> = {
  openapi: '3.0.0',
  info: {
    title: 'Express Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  },
  security: [
    {
      bearer: [],
    },
  ],
};
export const OpenApiDefinition = openapi(OpenApi);

OpenApiDefinition.component('securitySchemes', 'bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

type SchemaNames =
  | 'User'
  | 'SuccessMessage'
  | 'GenericError'
  | 'JWTToken'
  | 'RegisterBody'
  | 'SiteRequestBody'
  | 'Utility'
  | 'UtilityConsumption'
  | 'Site'
  | 'AddUtilityEmissionBody'
  | 'BusinessService';
type PathNames =
  | 'CreateUser'
  | 'Register'
  | 'Site'
  | 'Login'
  | 'CreateUtility'
  | 'GetDashboardData'
  | 'AddUtilityEmission'
  | 'GetUtilities'
  | 'GetUser'
  | 'UpdateUser'
  | 'UtilityFileImport';

type ResponsesName = 'GenericError' | 'UpdateUser' | PathNames;

export type CreateSchemaParams = {
  name: SchemaNames;
  schema: Omit<OpenAPIV3.SchemaObject, 'type' | 'additionalProperties'> & {
    properties?: {
      [name: string]:
        | OpenAPIV3.ReferenceObject
        | (OpenAPIV3.SchemaObject & {
            transform?: string[];
          });
    };
  };
};
export const createSchema = (p: CreateSchemaParams) => {
  OpenApiDefinition.component('schemas', p.name, {
    additionalProperties: false,
    ...p.schema,
    type: 'object',
  });
};

type ReferenceForParamsDict = {
  schemas: SchemaNames;
  responses: ResponsesName;
  requestBodies: PathNames;
};
type GetReferenceForParams<T extends keyof ReferenceForParamsDict> = {
  for: T;
  name: ReferenceForParamsDict[T];
};
export function getReferenceFor<A extends keyof ReferenceForParamsDict>(
  p: GetReferenceForParams<A>,
): OpenAPIV3.ReferenceObject {
  return OpenApiDefinition.component(p.for, p.name);
}

type RequestComponent = OpenAPIV3.RequestBodyObject & {
  content: {
    [media: string]: OpenAPIV3.MediaTypeObject & {
      schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
    };
  };
};
export const addRequestComponentFor = (name: PathNames, p: RequestComponent) => {
  return OpenApiDefinition.component('requestBodies', name, p);
};

export const addResponseComponentFor = (name: ResponsesName, p: OpenAPIV3.ResponseObject) => {
  return OpenApiDefinition.component('responses', name, p);
};

export const addParameterComponentFor = (name: PathNames, p: OpenAPIV3.ParameterObject) => {
  return OpenApiDefinition.component('parameters', name, p);
};
