import 'module-alias/register';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { app } from './app';
import { GlobalEnv } from '@lib';

const httpPort = GlobalEnv.PORT;
const env = GlobalEnv.NODE_ENV;

const logConnection = () => {
  console.log(`Server listening on port: ${httpPort} on ${env} mode`);
};
app.listen(httpPort, logConnection);
