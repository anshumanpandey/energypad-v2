import express from 'express';
import helmet from 'helmet';
import addRequestId from 'express-request-id';
import cors from 'cors';
import { OpenApiDefinition } from '@openApi';

const app = express();

app.use(helmet());
app.use(cors());
app.use(addRequestId());
app.use(OpenApiDefinition);

export {
  app
}