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
    useNullAsDefault: true,
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve('..', '..', '..', 'migrations'),
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: path.resolve('..', '..', '..', 'seeds', 'dev'),
      loadExtensions: ['.ts'],
      timestampFilenamePrefix: true,
    },
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve('testdb.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'knex_migrations',
      directory: path.resolve('migrations'),
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: path.resolve('seeds', 'test'),
      loadExtensions: ['.ts'],
      timestampFilenamePrefix: true,
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
    seeds: {
      directory: path.resolve('..', '..', '..', 'seeds', 'prod'),
      loadExtensions: ['.ts'],
      timestampFilenamePrefix: true,
    },
  },
};

export default config;

module.exports = config;
