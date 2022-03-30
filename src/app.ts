import express from 'express';
import addRequestId from 'express-request-id';
import cors from 'cors';
import OpenApiDefinition from '@openApi';
import { ErrorMiddleware, AppHelmet } from '@middleware';
import v1 from '@routes/v1';

const app = express();

app.use(AppHelmet);
app.use(cors());
app.use(addRequestId());
app.use(OpenApiDefinition);
app.use(express.json());
app.use('/assets', express.static(__dirname + '/../assets'));
app.use('/api', v1);
app.use(ErrorMiddleware);
app.use('/swaggerui', OpenApiDefinition.swaggerui);

export { app };
