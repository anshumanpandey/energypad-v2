import express from 'express';
import { ExpressAsync, RequestValidatorMiddleware } from '@middleware';
import { registerUser } from '@controllers';
import { RegisterPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.post(
  '/',
  RegisterPath,
  RequestValidatorMiddleware({
    body: 'Register',
  }),
  ExpressAsync(registerUser),
);

export default authRoutes;
