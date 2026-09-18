# Sprint 1 acceptance

Implementation date: 17 September 2026. The user explicitly authorised the V2 rebuild foundation following Sprint 0. Scope and access defaults are recorded in [SPRINT_1_DESIGN.md](SPRINT_1_DESIGN.md).

## Delivered

- Isolated Next.js/TypeScript application with Tailwind and Radix component foundation under `apps/web`; separate package, lockfile and PostgreSQL migration history.
- Responsive login, onboarding, workspace switching, overview, team management, settings, site read view and audit feed. Future energy modules have explicit availability states.
- Auth.js verified-email login, one-time tokens, revocable database sessions, logout and mail delivery adapter with private development capture.
- Organisations, five tenant roles, global platform role, invitations, assigned-site relationships, internal plans/entitlements and immutable audit records.
- Server-side authorization, strict schemas, bounded input, origin checks, last-owner locking, safe error responses and request IDs.
- Idempotent plan seed, isolated local PostgreSQL runner, disposable integration/browser databases and scoped GitHub Actions workflow.

## Verification evidence

| Check | Result |
|---|---|
| Prisma generation and migration deploy | Passed against dedicated V2 PostgreSQL and disposable test databases |
| Internal plan seed | Passed; no customer/demo accounts or metrics seeded |
| Source formatting and ESLint | Passed |
| TypeScript and Next route generation | Passed |
| Unit tests | 4 passed: role/ownership policy, entitlements, input normalization and validation |
| Real PostgreSQL integration | 10 scenarios passed: verified onboarding, tenant isolation, site scope/FKs, admin restrictions, single-use/email-bound invitations, expired/revoked/issuer-demoted grants, delivery failure/revocation, concurrent owners, immutable audit, no platform bypass |
| Production build | Passed using the supported Next.js Webpack compiler |
| Browser workflow and mobile review | Passed: Chromium real email-link registration → organisation → invitation → acceptance; settings, ownership guard, guessed-tenant denial, organisation switching, role change, immediate revocation, token reuse rejection, logout and responsive navigation. Desktop 1440px and phone 390px screenshots reviewed; no overflow or browser exceptions. |
| Dependency audit | 0 vulnerabilities after omitting unused provider peers and pinning patched Prisma transitive utilities |
| Legacy preservation | 564/564 Sprint 0 source hashes unchanged |

CI configuration is supplied; a remote GitHub Actions run has not been triggered or claimed. The branch has not been pushed or deployed.

## Deferred intentionally

Full site/meter CRUD is Sprint 2. Energy imports, regression calculations, dashboards with actual energy metrics, reporting, AI, Stripe billing and migration are later milestones. Internal plan limits do not constitute approved commercial pricing. Enterprise's custom allowance remains unset until its commercial policy is agreed.

Production database, verified sender/Resend credentials, HTTPS host and secret, restricted database roles, ingress controls and deployment operating policies still require configuration. Auth.js is pinned to a beta release behind its adapter. The missing regression workbooks and NRA formula/cache discrepancy from Sprint 0 remain open for Sprint 4; no calculations were changed.

## Onboarding fix — 18 September 2026

The creation form used the client hydration flag as a pending mutation flag, so an unhydrated page displayed a disabled “Saving…” button before submission. Onboarding now uses an authenticated Server Action and a progressively enhanced form. The button is enabled in the server-rendered HTML, pending feedback only starts on submission, validation errors retain the entered values, and successful creation redirects on the server. The loading boundary is scoped to organisation routes so onboarding can render without client scripts.

Verification: the normal browser workflow passed; a dedicated JavaScript-disabled regression passed for enabled submission, validation feedback, retained input, successful redirect and persisted Owner membership. Lint and TypeScript checks passed.
