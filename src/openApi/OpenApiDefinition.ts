//@ts-expect-error library does not include a typescript definition
import openapi from '@wesleytodd/openapi';

export const OpenApiDefinition = openapi({
  openapi: '3.0.0',
  info: {
    title: 'Express Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  },
});
