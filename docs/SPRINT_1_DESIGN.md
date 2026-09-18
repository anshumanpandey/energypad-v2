# Sprint 1 foundation design

Implementation authorized by the user after Sprint 0 discovery. This does not approve migration/cutover or resolve Sprint 4 fixture conflicts.

## Implementation sequence

1. Create an isolated Next.js 16 App Router application in apps/web with strict TypeScript, Tailwind and shadcn-style Radix primitives. Preserve legacy root dependencies and sources.
2. Add PostgreSQL/Prisma schema, migrations and idempotent plan seed. Introduce domain services separated from routes/UI.
3. Configure Auth.js email verification with database sessions; verified email is required for organisation creation and invitation acceptance. Local mail is captured rather than delivered externally.
4. Implement organisation onboarding/switching, role enforcement, invitations, membership management, assigned-site access and append-only audit events. Tenant ID comes from the URL plus verified membership, never trusted request data.
5. Build responsive workspace shell, overview, members, settings, audit and foundation site read view. Future modules have truthful empty states, not invented energy statistics.
6. Verify with unit, PostgreSQL integration and browser tests plus lint, typecheck and production build. Map gates to evidence in SPRINT_1_ACCEPTANCE.md.

## Proposed schema

User (UUID, email, verified timestamp, display name, platform role) has many Auth.js Accounts and Sessions and many Memberships. VerificationToken stores Auth.js single-use email tokens. Organisation (UUID, name, slug, currency, timezone, plan) has Memberships, Invitations, Sites and AuditEvents. Membership joins user and organisation uniquely, with role and revocation timestamp. SiteAssignment joins membership and site using composite organisation foreign keys, preventing cross-tenant references in PostgreSQL. Invitation has a unique hashed random token, normalized email, role, issuer, expiry and accepted/revoked timestamp. InvitationSite similarly constrains site grants to its organisation. Only verified matching email can accept it, atomically and once.

Plan stores internal stable key, site limit and feature entitlements; no Stripe state or billing is simulated. Organisation begins with Starter. Site is a minimal foundation resource (name/code/organisation); full site/meter editing is Sprint 2. AuditEvent stores actor, organisation, action, target, correlation ID and safe structured metadata; database triggers reject update/delete. UUIDs and timestamptz are used throughout. Member changes lock the organisation to serialize last-owner protection and authorization changes.

## Access decisions

Owner manages organisation, invitations, all memberships and future billing. Admin manages invitations and members below Owner and cannot grant Owner. Analyst reads organisation/site data and later manages analytical work; Viewer is read-only. Site Manager sees assigned sites only; new site managers have no site access until assigned. Both Analyst and Viewer can see all sites within their organisation. Owner/Admin alone read the membership directory and audit feed. Platform Admin is a separate global user flag; it does not automatically bypass tenant membership. Cross-tenant support access is deferred to the audited impersonation flow in Sprint 8.

A user may belong to multiple organisations. Membership and role are queried on every service request, not cached in a role-bearing session token. Revocation takes effect immediately. An organisation must retain an active Owner. Existing membership cannot be silently elevated by accepting an invitation. Expired/revoked/used invitations fail. Raw invitation tokens appear only in the email, never in audit responses or logs.

## Chosen defaults and boundaries

Auth.js behind server/auth.ts uses the Resend email provider with a custom delivery adapter for magic links, Prisma adapter and revocable database sessions. No passwords or legacy credentials are imported. Invitations use a mail adapter with private .local/mail capture in development and configured Resend HTTP delivery in production. Email sending is part of the application; implementation tests use only local capture.

Apps/web has an independent package.json, lockfile and Prisma history; root API remains untouched. Provider credentials, production URL, email delivery, database access and operating policies must be configured before deployment. Production schema/migration questions and calculation fixture issues remain deferred to their dependent sprints. No deployment or real invitation delivery is authorized by this implementation task.

## Documentation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Auth.js email provider](https://authjs.dev/getting-started/providers/resend)
- [Auth.js Prisma adapter](https://authjs.dev/getting-started/adapters/prisma)
