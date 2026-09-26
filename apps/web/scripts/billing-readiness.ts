import 'dotenv/config';
import { billingReadiness } from '../src/server/billing-readiness';
if (process.argv.length > 2) {
  console.error('Usage: npm run billing:readiness (reads local environment only; makes no network calls)');
  process.exitCode = 1;
} else {
  const report = billingReadiness(process.env);
  console.log(JSON.stringify(report, null, 2));
  if (report.checks.some((check) => check.status === 'INVALID')) process.exitCode = 1;
  else if (report.readConfiguration === 'BLOCKED' || report.webhookConfiguration === 'BLOCKED') process.exitCode = 2;
}
