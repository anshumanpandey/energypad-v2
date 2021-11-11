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
      BearerAuth: ['http', 'bearer'],
    },
  ],
};
export const OpenApiDefinition = openapi(OpenApi);

type SchemaNames = 'User' | 'SuccessMessage' | 'GenericError' | 'JWTToken' | 'RegisterBody';
type PathNames = 'CreateUser' | 'Register' | 'Login' | 'Site';

export type CreateSchemaParams = {
  name: SchemaNames;
  schema: Omit<OpenAPIV3.SchemaObject, 'type'>;
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
  responses: PathNames;
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

export const addRequestComponentFor = (name: PathNames, p: OpenAPIV3.RequestBodyObject) => {
  return OpenApiDefinition.component('requestBodies', name, p);
};

export const addResponseComponentFor = (name: PathNames, p: OpenAPIV3.ResponseObject) => {
  return OpenApiDefinition.component('responses', name, p);
};
