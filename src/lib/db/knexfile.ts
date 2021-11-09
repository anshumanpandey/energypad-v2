// Update with your config settings.
import path from 'path';

export const config = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve('dev.sqlite3'),
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
};

export default config;

module.exports = config;
