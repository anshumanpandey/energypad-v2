import express from 'express';
import { RequestValidatorMiddleware } from '@middleware';
import { CreateUserPath } from '@openApi';

const userRoutes = express.Router();

userRoutes.post(
  '/address',
  CreateUserPath,
  RequestValidatorMiddleware({
    body: 'CreateUser',
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
