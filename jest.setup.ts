// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ts-node').register({ transpileOnly: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DB = require('./src/lib/db/Db').default;

const setup = async (): Promise<void> => {
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
