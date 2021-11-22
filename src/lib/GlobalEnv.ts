import { cleanEnv, str, num } from 'envalid';

const GlobalEnv = cleanEnv(process.env, {
  LOG_ENABLED: str({ choices: ['CONSOLE', 'FILE'], default: 'CONSOLE' }),
  JWT_SECRET: str({ devDefault: '6884-***4/22' }),
  DB_DIALECT: str({ choices: ['sqlite', 'postgresql'], devDefault: 'sqlite' }),
  PROD_DB_HOSTNAME: str({ devDefault: '' }),
  DB_NAME: str({ devDefault: '' }),
  DB_PASSWORD: str({ devDefault: '' }),
  DB_USERNAME: str({ devDefault: '' }),
  PORT: num({ devDefault: 5000 }),
  NODE_ENV: str({ choices: ['development', 'test', 'production', 'staging'] }),
});

export default GlobalEnv;
