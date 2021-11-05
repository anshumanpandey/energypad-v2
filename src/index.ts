import 'module-alias/register';
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { app } from './app';
import { GlobalEnv } from '@lib';

const httpPort = GlobalEnv.PORT;

const logConnection = () => {
    console.log(`Server listening on port: ${httpPort}`);
};
app.listen(httpPort, logConnection);
