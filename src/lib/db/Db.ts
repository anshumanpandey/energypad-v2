import knex from 'knex';
import GlobalEnv from '../GlobalEnv';
import config from './knexfile';

const opt = config[GlobalEnv.NODE_ENV as 'development'];
const DB = knex(opt);

export default DB;
