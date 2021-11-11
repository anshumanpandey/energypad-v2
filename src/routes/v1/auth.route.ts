import express from 'express';
import { ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { AuthController } from '@controllers';
import { RegisterPath, LoginPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.post(
  '/',
  RegisterPath,
  RequestValidatorMiddleware({
    body: 'Register',
  }),
  ExpressAsync(AuthController.registerUser),
);

authRoutes.post(
  '/login',
  LoginPath,
  RequestValidatorMiddleware({
    body: 'Login',
  }),
  ExpressAsync(AuthController.loginUser),
);

export default authRoutes;
