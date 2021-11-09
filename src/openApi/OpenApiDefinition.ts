//@ts-expect-error library does not include a typescript definition
import openapi from '@wesleytodd/openapi';
import { OpenAPIV3 } from 'openapi-types';

const OpenApi: Pick<OpenAPIV3.Document, 'openapi' | 'info' | 'servers'> = {
  openapi: '3.0.0',
  info: {
    title: 'Express Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  },
};
export const OpenApiDefinition = openapi(OpenApi);

type SchemaNames = 'User' | 'CreateUser';

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

type GetSchemaComponentForParams = {
  name: SchemaNames;
  for: 'schemas' | 'responses' | 'requestBodies';
};
export const getSchemaComponentFor = (p: GetSchemaComponentForParams) => {
  return OpenApiDefinition.component(p.for, p.name);
};
