import express from 'express';
import helmet from 'helmet';
import addRequestId from 'express-request-id';
import cors from 'cors';

const app = express();

app.use(helmet());
app.use(addRequestId());
app.use(cors());
app.use(addRequestId());

export {
  app
}