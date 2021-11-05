import { OpenApiDefinition } from "../OpenApiDefinition";

OpenApiDefinition.schema('User', {
  "type": "object",
  "required": [
    "name"
  ],
  "properties": {
    "name": {
      "type": "string"
    },
  }
});