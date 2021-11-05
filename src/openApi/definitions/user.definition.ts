import { OpenApiDefinition } from "../OpenApiDefinition";

OpenApiDefinition.component("schemas",'User', {
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