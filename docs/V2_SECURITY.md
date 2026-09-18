# V2 foundation security model

## Identity and tenant context

Auth.js email links last 15 minutes and are consumed once by the Prisma adapter. Sessions are stored in PostgreSQL for seven days and removed on logout. The session holds identity, not authoritative tenant roles. Every domain request checks the user's current active membership and verified email. No organisation ID, role or plan supplied by a browser is trusted without validation and authorisation.

The organisation URL identifies the requested scope. Cross-tenant IDs return the same unavailable response as missing records. PostgreSQL composite foreign keys bind SiteAssignment and InvitationSite to matching organisation IDs. PostgreSQL row-level security is **not** claimed: service checks and relationship constraints are the enforcement layers in Sprint 1. Any future repository/query path must preserve these checks.

| Role | Organisation settings | Team and invitations | Site reads | Audit | Future billing |
|---|---|---|---|---|---|
| Owner | Yes | All roles | All organisation sites | Yes | Yes |
| Admin | Yes | Non-owners only; cannot grant Owner | All organisation sites | Yes | No |
| Analyst | No | No | All organisation sites | No | No |
| Site manager | No | No | Assigned sites only | No | No |
| Viewer | No | No | All organisation sites | No | No |

Platform Admin is a separate user flag, **not** a tenant bypass. Support impersonation is deferred. Site-manager membership alone grants no site access. Role changes clear old site grants so later demotion cannot restore stale permissions. Revoked membership fails the next service/API request even when its login session remains valid for another organisation.

## Mutations and invitations

Organisation membership mutations lock their organisation row and re-read authorization inside the transaction. Concurrent owner demotions/removals cannot remove the last Owner. Organisation creation locks the user row to enforce a maximum of ten owned workspaces. Browser JSON mutations require an exact configured Origin; Auth.js/Next server actions provide their own CSRF handling. Unknown fields are rejected and JSON bodies are limited to 16 KiB while streaming.

Invitation tokens contain 32 random bytes; only SHA-256 hashes are stored. A verified matching email, unexpired/unrevoked/unused token and currently authorised issuer are required at acceptance. Consumption and membership creation happen under the organisation lock. Existing active membership cannot be silently elevated. Mail failures revoke the issued token and leave an audit record. A fresh invitation revokes previous pending invitations for the same address in that organisation.

Sending is limited to 20 invitations per issuer/organisation/hour and five sign-in links per normalized email/15-minute window. These controls are not a substitute for deployment-level rate limits against distributed abuse. Sign-in buckets expire and are cleaned on subsequent requests. User-facing errors are generic, while API errors include a request ID for support.

## Audit and secrets

Audit events store organisation, actor ID, action, target, request ID, safe metadata and timestamp in the same transaction as the change. PostgreSQL triggers reject UPDATE, DELETE and TRUNCATE. The organisation foreign key also blocks cascading deletion of audit history. This protects against ordinary SQL/application mutation, not a database superuser disabling triggers. Use separate restricted application and migration roles in production.

Raw auth/invitation tokens are not returned by membership APIs or stored in audit metadata. Development mail is private on-disk capture, excluded from Git and never served by the app. Production uses Resend HTTPS delivery and requires explicit configuration. Next.js development request/action logging is disabled to keep token-bearing URLs and form arguments out of local logs. Reverse-proxy access logs must redact sensitive callback/invitation URLs. Secrets, database files and browser traces are excluded from source control.

Headers deny framing, MIME sniffing, third-party content and sensitive URL paths/queries in referrers. CSP currently permits inline scripts/styles required by the app; nonce-based strict CSP and deployment-specific transport policies remain hardening work. No external analytics, font requests, customer metrics or financial integrations are enabled.

## Evidence and boundaries

`apps/web/scripts/integration.ts` tests authorization and database invariants on real PostgreSQL. `apps/web/tests/e2e/foundation.spec.ts` exercises the actual browser/session/email flow, hostile origins, guessed tenant IDs and access revocation. No test login backdoor exists in production routes. See the Sprint 1 acceptance report for executed checks.

SSO/MFA, support impersonation, customer data migration, bulk import, calculation engines, report sharing, billing webhooks, backup restoration, retention and deployment observability are not implemented in this sprint.
