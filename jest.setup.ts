// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ts-node').register({ transpileOnly: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DB = require('./src/lib/db/Db').default;

const setup = async (): Promise<void> => {
  let tables: { tablename: string }[] = await DB('pg_catalog.pg_tables')
    .select('tablename')
    .where({ schemaname: 'public' });
  const tablesToIgnore = ['knex_migrations', 'knex_migrations_lock'];
  tables = tables.filter((t) => !tablesToIgnore.includes(t.tablename));

  for (let idx = 0; idx < tables.length; idx++) {
    const t = tables[idx];
    await DB.raw(`TRUNCATE "${t.tablename}" CASCADE;`);
  }
    
  return DB.migrate
    .rollback(undefined, true)
    .then(() => {
      console.log('TEST DB DELETED');
      return DB.migrate.latest();
    })
    .then(function () {
      return DB.seed.run();
    })
    .catch((err: Error) => {
      console.log(err);
      return err;
    });
};

export default setup;
