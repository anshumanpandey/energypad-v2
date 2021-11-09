import express from 'express';
import { ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { createUserController } from '@controllers';
import { CreateUserPath } from '@openApi';

const userRoutes = express.Router();

userRoutes.post(
  '/address',
  CreateUserPath,
  RequestValidatorMiddleware({
    body: 'CreateUser',
  }),
  ExpressAsync(createUserController),
);

export default userRoutes;
