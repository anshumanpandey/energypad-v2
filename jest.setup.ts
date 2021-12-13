// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ts-node').register({ transpileOnly: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DB = require('./src/lib/db/Db').default;

const setup = async (): Promise<void> => {
  await DB.migrate.latest().then(function () {
    return DB.seed.run();
  });
};

export default setup;
