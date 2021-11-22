// Update with your config settings.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import path from 'path';

export const config = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.PWD + '/dev.sqlite3',
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve('..', '..', '..', 'migrations'),
      loadExtensions: ['.ts'],
    },
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve('testdb.sqlite3'),
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve('migrations'),
      loadExtensions: ['.ts'],
    },
  },

  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user: 'username',
      password: 'password',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
    },
  },

  production: {
    client: process.env.DB_DIALECT,
    connection: {
      host: process.env.PROD_DB_HOSTNAME,
      port: 5432,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve('..', '..', '..', 'migrations'),
      loadExtensions: ['.ts'],
    },
  },
};

export default config;

module.exports = config;
