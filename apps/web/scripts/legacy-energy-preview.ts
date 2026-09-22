import { readMigrationJson } from './migration-json';
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { db } from '../src/server/db';
import { actorFor } from '../src/server/foundation';
import { LegacyEnergyMigration } from '../src/server/legacy/energy-migration';
import { DomainError, uuid } from '../src/domain/policy';
const [org, user, file, output, ...extra] = process.argv.slice(2);
try {
  if (!org || !user || !file || !output || extra.length)
    throw new DomainError(
      'USAGE',
      'Usage: npm run migration:preview:energy -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <new-report.json>',
    );
  uuid.parse(org);
  uuid.parse(user);
  const input = await readMigrationJson(file);
  const service = new LegacyEnergyMigration(
    db,
    {
      async send() {
        throw new Error('Mail is disabled for migration previews.');
      },
    },
    'http://localhost:3100',
  );
  const report = await service.preview(actorFor(user), org, input);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(
    `Dry run: ${report.ready ? 'ready for review' : 'blocked'}; ${report.issues.length} source or target issues. No database records changed.`,
  );
  if (!report.ready) process.exitCode = 2;
} catch (error) {
  console.error(
    error instanceof DomainError
      ? error.message
      : 'Preview failed. Check the arguments, file permissions and database access. No report was overwritten.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
