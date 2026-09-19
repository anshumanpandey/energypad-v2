# EnergiePad V2 — sites and import

An isolated Next.js application alongside the legacy Express/React applications. It has its own dependencies, database and migrations. Run commands **from this directory**, not the repository root. Nothing here migrates legacy data.

## Local development

Requires Node.js 22.12+ and npm. Node 22 is used in CI. Development and builds explicitly use Next.js’s Webpack compiler for portability in restricted environments.

```sh
cd apps/web
npm ci
npm run db:generate
npm run local:services
```

The last command starts PostgreSQL on `127.0.0.1:55432`, stores it under `.local/postgres`, and creates a private `.env` with a random auth secret if one does not exist. It does not change existing environment files. Leave that terminal running. The embedded PostgreSQL binary runs as your normal user; Docker and sudo are not required. Do not run it as root.

In another terminal, from `apps/web`:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3100** (use this hostname to match `AUTH_URL`). Sign in with an email address. In development, with no `RESEND_API_KEY`, email messages are captured as private JSON files under `.local/mail`. Open the newest file and follow the URL in its `text` field. Nothing is delivered to an external recipient. The inbox is deliberately not exposed through HTTP. Treat these files as credentials and delete expired messages when no longer needed.

After verification, create an organisation, invite a teammate, and open their invitation in a separate browser profile. Sign in with the **invited email** and accept. Settings and role management require Owner/Admin; only Owners can manage other Owners. Create another organisation from the sidebar and use the workspace selector to switch.

The plan seed is idempotent and creates only the four internal plan definitions. It does not create users, demo metrics, sites or credentials. Site/portfolio management, meters and site workbook imports are available. Energy data, analysis, reports, billing and legacy account migration remain later sprints.

To use an existing **dedicated V2** PostgreSQL server instead, copy `.env.example` to `.env`, set `DATABASE_URL` and a random `AUTH_SECRET`, and omit `local:services`. Never point the migration commands at a legacy or shared production database.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=high
```

Integration and browser tests each create a uniquely named disposable database. They do not reset `DATABASE_URL`. By default they start their own temporary PostgreSQL cluster; in CI, `TEST_DATABASE_ADMIN_URL` points to a test-only PostgreSQL service with permission to create/drop databases. The browser harness starts a separate app at `localhost:3101`, uses `.next-e2e`, captures email locally and deletes its database when it exits. Browser output lives under `test-results` and `playwright-report` (gitignored). Failed browser traces can contain test sign-in tokens; retain them only in private CI artifacts.

## Structure

- `src/domain/policy.ts`: validated inputs, role matrix and internal entitlements.
- `src/server/foundation.ts`: tenant-aware transactional use cases; usable independently of the UI.
- `src/server/auth.ts`, `mail.ts`: Auth.js database sessions and email delivery adapter.
- `src/server/http.ts`: authentication, origin enforcement, bounded input and safe problem responses.
- `src/app/api/v1/[...segments]/route.ts`: REST transport.
- `src/app`, `src/components`: responsive workspace and reusable Radix-based button primitive.
- `prisma`: PostgreSQL schema, migration and plan seed.
- `scripts`, `tests`: local runtime and security/browser tests.

Auth.js is pinned to `5.0.0-beta.32`; it is a deliberate pre-release dependency behind the auth boundary, requiring review before deployment. `.npmrc` omits unused peer dependencies, including the unused Nodemailer provider. Required peers are explicit dependencies. `deepmerge-ts` and `mysql2` overrides pin patched transitive Prisma utilities; migration/build checks cover the Prisma paths used here. ExcelJS’s uuid dependency is overridden to 11.1.1 to address its audit advisory; XLSX read/write tests exercise compatibility. Review overrides when upgrading these packages.

## Production configuration (not deployed)

Set a dedicated PostgreSQL `DATABASE_URL`, an HTTPS `AUTH_URL`, a cryptographically random `AUTH_SECRET`, a Resend `RESEND_API_KEY` and `EMAIL_FROM` using a verified sender domain. Mail capture is disabled in production; missing delivery configuration fails closed. Restrict the application database role to normal DML, and use a separate migration role so the application cannot disable triggers. Set the trusted proxy/host configuration for the chosen host and redact auth callback/invitation URLs in ingress logs. The app does not log raw tokens.

Migrate and seed before starting the app. Production backup/restore, retention, legal policies, abuse controls at the ingress, observability and legacy cutover remain deployment/Sprint 8 work. This implementation does not send real email, deploy, configure billing, or import legacy accounts.

See [Sprint 1 design](../../docs/SPRINT_1_DESIGN.md), [security model](../../docs/V2_SECURITY.md) and [acceptance evidence](../../docs/SPRINT_1_ACCEPTANCE.md).

## Sprint 2 workflow

Owners/Admins can create portfolios, add sites, maintain meter records and append site attribute snapshots. Archive removes a resource from active use while preserving history and audit. Site managers only read assigned sites. Portfolio grouping is available as a structural feature; paid portfolio analytics remain future work.

Data accepts XLSX files up to 2 MB, with up to 10 sheets, 50 columns and 2,000 rows per sheet (10 MB expanded ZIP limit). Header row is row 1. Password/credential columns are discarded before database staging; the raw workbook is not saved. Formula/error cells are rejected. Choose a sheet, map fields/defaults, select the source business email when present, and confirm the sites belong to the current organisation. Supply missing codes or a prefix and an effective date for any historical attributes. Units must already be m² and hours/week. Download row errors, correct mapping or re-upload corrected data, then validate and commit. Commit rechecks site codes and the plan limit atomically. Repeated identical sanitized uploads reuse a batch; a committed batch cannot be imported twice.

Imports create new sites only. Existing codes, including archived codes, are rejected rather than updated. Business-account sheets do not create accounts or organisations; invitations remain the account activation workflow. Original fixture credentials never become customer identities. Consumption import and calculations are Sprint 3+. No original workbook or calculation fixture is rewritten.

See [Sprint 2 design](../../docs/SPRINT_2_DESIGN.md) and [acceptance](../../docs/SPRINT_2_ACCEPTANCE.md).
