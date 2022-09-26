// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ts-node').register({ transpileOnly: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DB = require('./src/lib/db/Db').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const opt = require('./src/lib/db/knexfile');

const setup = async (): Promise<void> => {
  await DB.migrate
    .rollback(undefined, true)
    .then(() => {
      console.log('TEST DB DELETED');
      return DB.migrate.latest();
    })
    .then(function () {
      return DB.seed.run();
    });
};

export default setup;
