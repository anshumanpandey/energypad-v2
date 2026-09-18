import 'dotenv/config';
import { db } from '../src/server/db';
import { plans } from '../src/domain/policy';

for (const plan of plans) {
  await db.plan.upsert({
    where: { key: plan.key },
    create: plan,
    update: { name: plan.name, siteLimit: plan.siteLimit, entitlements: plan.entitlements },
  });
}
console.log('Seeded the four internal plans. No users, credentials or customer data were created.');
await db.$disconnect();
