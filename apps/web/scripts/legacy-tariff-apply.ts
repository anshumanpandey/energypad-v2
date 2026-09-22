import 'dotenv/config';
import { db } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { DomainError, uuid } from '../src/domain/policy';
import { LegacyTariffApply } from '../src/server/legacy/tariff-apply';
import { readMigrationJson } from './migration-json';
const [org, user, file, reviewed, ...extra] = process.argv.slice(2);
try {
  if (!org || !user || !file || !reviewed || extra.length)
    throw new DomainError(
      'USAGE',
      'Usage: npm run migration:apply:tariffs -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <reviewed-report.json>',
    );
  uuid.parse(org);
  uuid.parse(user);
  const service = new LegacyTariffApply(
    db,
    {
      async send() {
        throw new Error('Mail disabled');
      },
    },
    'http://localhost:3100',
  );
  const result = await service.apply(
    actorFor(user),
    org,
    await readMigrationJson(file),
    await readMigrationJson(reviewed),
  );
  console.log(
    `${result.reused ? 'Previously applied' : 'Applied'} batch ${result.batch.id}. Receipt stored in LegacyTariffBatch; identical retries return this batch without new writes.`,
  );
} catch (error) {
  console.error(
    error instanceof DomainError
      ? error.message
      : 'Apply failed. Check arguments, reviewed report and database access. If completion was interrupted, retry the identical bundle and report to recover its receipt.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
