import express from 'express';
import { ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { registerUser, loginUser } from '@controllers';
import { RegisterPath, LoginPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.post(
  '/',
  RegisterPath,
  RequestValidatorMiddleware({
    body: 'Register',
  }),
  ExpressAsync(registerUser),
);

authRoutes.post(
  '/login',
  LoginPath,
  RequestValidatorMiddleware({
    body: 'Login',
  }),
  ExpressAsync(loginUser),
);

export default authRoutes;
