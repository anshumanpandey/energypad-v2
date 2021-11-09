import express from 'express';
import { AppController, ResponseKeys } from '@types';
import { ApiError } from '@lib';

const expressAsync =
  (fn: AppController<ResponseKeys>) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req).then((response) => {
      if (response instanceof ApiError) {
        next(response);
      } else {
        res.json(response);
      }
    });
  };

export default expressAsync;
