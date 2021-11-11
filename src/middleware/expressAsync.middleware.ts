import express from 'express';
import { MixAppController, ResponseKeys } from '@types';
import { ApiError } from '@lib';

const expressAsync =
  <T extends ResponseKeys>(fn: MixAppController<T>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    //@ts-expect-error TODO: fix this type
    fn(req)
      .then((response) => {
        if (response instanceof ApiError) {
          next(response);
        } else {
          res.json(response);
        }
      })
      .catch((err) => next(err));
  };

export default expressAsync;
