import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UserController } from '@controllers';
import { GetUserPath, UpdateUserPath } from '@openApi';

const businessRoutes = express.Router();

businessRoutes.put(
  '/',
  UpdateUserPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'UpdateUser',
  }),
  ExpressAsync(UserController.updateUser),
);

businessRoutes.get('/', GetUserPath, AuthMiddleware, ExpressAsync(UserController.getMet));

export default businessRoutes;
