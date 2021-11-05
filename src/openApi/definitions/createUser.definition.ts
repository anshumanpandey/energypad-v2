import { OpenApiDefinition } from "../OpenApiDefinition";

OpenApiDefinition.component("requestBodies",'CreateUser', {
  "description": "User to add to the system",
  "content": {
    "application/json": {
      "schema": OpenApiDefinition.component("schemas", "User"),
    }
  }
});