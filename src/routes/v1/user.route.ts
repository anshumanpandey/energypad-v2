import express from 'express';
import { AllowedSchema } from 'express-json-validator-middleware';
import { RequestValidatorMiddleware } from '@middleware';
import schema from '../../types/Schema.json';

const userRoutes = express();

userRoutes.post(
  '/address',
  RequestValidatorMiddleware({
    body: schema.components.requestBodies.CreateUser.content['application/json'].schema as AllowedSchema,
  }),
  (request, response) => {
    /**
     * Route handler logic to run when `request.body` has been validated.
     */
    //TODO: 2ksjlakjsd
    response.send({ success: '' });
  },
);

export default userRoutes;
