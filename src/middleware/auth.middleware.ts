import jwt from 'express-jwt';
import { GlobalEnv } from '@lib';

const AuthMiddleware = jwt({ secret: GlobalEnv.JWT_SECRET, algorithms: ['HS256'] });

export default AuthMiddleware;
