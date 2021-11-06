import express from 'express';
import { AllowedSchema } from 'express-json-validator-middleware';
import requestValidator from '../../middleware/requestValidator.middleware';
import schema from '../../types/Schema.json';

const userRoutes = express();

userRoutes.post(
  '/address',
  requestValidator({
    body: schema.components.requestBodies.CreateUser.content['application/json'].schema as AllowedSchema,
  }),
  (request, response) => {
    /**
     * Route handler logic to run when `request.body` has been validated.
     */
    response.send({ success: true });
  },
);

export default userRoutes;
