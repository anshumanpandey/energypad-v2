import knex from 'knex';
import GlobalEnv from '../GlobalEnv';
import config from './knexfile';

const opt = config[GlobalEnv.NODE_ENV as 'development'];
const DB = knex(opt);

if (GlobalEnv.isTest) {
  DB.raw('PRAGMA foreign_keys = ON;').then(() => {
    console.log('Foreign Key Check activated.');
  });
}

export default DB;
