import express from 'express';
import helmet from 'helmet';
import addRequestId from 'express-request-id';
import cors from 'cors';
import OpenApiDefinition from '@openApi';
import { ErrorMiddleware } from '@middleware';
import v1 from '@routes/v1';

const app = express();

app.use(helmet());
app.use(cors());
app.use(addRequestId());
app.use(OpenApiDefinition);
app.use(express.json());
app.use('/api', v1);
app.use(ErrorMiddleware);

export { app };
