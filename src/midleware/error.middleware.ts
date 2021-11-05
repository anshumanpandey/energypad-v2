import express from "express";
import { ApiError, AppLogger } from "@lib";

const ErrorMiddleware = (err: express.Errback, req: express.Request, res: express.Response) => {
  let errResponse = {
    statusCode: 500,
    message: 'Unknown Error',
  }
  if (err instanceof ApiError) {
    AppLogger.error({ err, 'id-req': req.id, message: err.message });
    errResponse = {
      statusCode: err.code,
      message: err.message,
    }
  } else if (err.name === 'UnauthorizedError') {
    errResponse = {
      statusCode: 401,
      message: 'Unauthorized',
    }
  } else {
    AppLogger.fatal({ err, 'id-req': req.id });
  }

  res.status(500).json(errResponse);
}

export default ErrorMiddleware;