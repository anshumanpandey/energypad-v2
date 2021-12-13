import express from 'express';
import { ValidationError } from 'express-json-validator-middleware';
import { ApiError, AppLogger } from '@lib';

const ErrorMiddleware = (
  err: express.Errback,
  req: express.Request,
  res: express.Response,
  _: express.NextFunction,
) => {
  let errResponse = {
    statusCode: 500,
    message: 'Unknown Error',
  };
  if (err instanceof ApiError) {
    AppLogger.error({ err, 'id-req': req.id, message: err.message });
    errResponse = {
      statusCode: err.code,
      message: err.message,
    };
  } else if (err instanceof ValidationError) {
    let message = 'Invalid Body';
    AppLogger.error({ err, 'id-req': req.id, message: err.message });
    if (err.validationErrors.body) {
      const error = err.validationErrors.body.pop()?.message;
      if (error) {
        message = error;
      }
    }
    errResponse = {
      statusCode: 400,
      message,
    };
  } else if (err.name === 'UnauthorizedError') {
    errResponse = {
      statusCode: 401,
      message: 'Unauthorized',
    };
  } else {
    AppLogger.fatal({ err, 'id-req': req.id });
  }

  res.status(errResponse.statusCode).json(errResponse);
};

export default ErrorMiddleware;
