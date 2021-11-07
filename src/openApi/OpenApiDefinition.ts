//@ts-expect-error library does not include a typescript definition
import openapi from '@wesleytodd/openapi';
import { AllowedSchema } from 'express-json-validator-middleware';

export const OpenApiDefinition = openapi({
  openapi: '3.0.0',
  info: {
    title: 'Express Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  },
});

type SchemaNames = 'User' | 'Record';

export type CreateSchemaParams = {
  name: SchemaNames;
  schema: AllowedSchema;
};
export const createSchema = (p: CreateSchemaParams) => {
  OpenApiDefinition.component('schemas', p.name, {
    type: 'object',
    additionalProperties: false,
    ...p.schema,
  });
};

type GetSchemaComponentForParams = {
  name: SchemaNames;
  for: 'schemas' | 'responses' | 'requestBodies';
};
export const getSchemaComponentFor = (p: GetSchemaComponentForParams) => {
  return OpenApiDefinition.component(p.for, p.name);
};
