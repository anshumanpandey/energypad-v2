import express from 'express';
import { AuthMiddleware, ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { UserController } from '@controllers';
import { GetUserPath, UpdateUserPath, AddBrandToBusinessPath } from '@openApi';

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

businessRoutes.post(
  '/setBrands',
  AddBrandToBusinessPath,
  AuthMiddleware,
  RequestValidatorMiddleware({
    body: 'SetBrands',
  }),
  ExpressAsync(UserController.addBrands),
);

export default businessRoutes;
