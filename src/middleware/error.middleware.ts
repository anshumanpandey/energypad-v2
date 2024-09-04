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
    list: undefined as undefined | string[],
  };
  if (err instanceof ApiError) {
    const messages = err.opt?.from?.map((e) => e.message);
    AppLogger.error({ err, 'id-req': req.id, message: err.message, endpoint: req.url });
    errResponse = {
      statusCode: err.code,
      message: err.message,
      list: messages,
    };
  } else if (err instanceof ValidationError) {
    let message = 'Invalid Body';
    AppLogger.error({ err, 'id-req': req.id, message: err.message, endpoint: req.url });
    if (err.validationErrors.body) {
      const error = err.validationErrors.body.pop();
      if (error) {
        message = `${error.dataPath ? error.dataPath.slice(1) + ': ' : ''}${error.message || 'invallid'}`;
      }
    }
    errResponse = {
      statusCode: 400,
      message,
      list: undefined,
    };
  } else if (err.name === 'UnauthorizedError') {
    errResponse = {
      statusCode: 401,
      message: 'Unauthorized',
      list: undefined,
    };
  } else {
    AppLogger.fatal({ err, 'id-req': req.id, endpoint: req.url });
  }

  res.status(errResponse.statusCode).json(errResponse);
};

export default ErrorMiddleware;
