# V2 foundation security model

## Identity and tenant context

Auth.js email links last 15 minutes and are consumed once by the Prisma adapter. Sessions are stored in PostgreSQL for seven days and removed on logout. The session holds identity, not authoritative tenant roles. Every domain request checks the user's current active membership and verified email. No organisation ID, role or plan supplied by a browser is trusted without validation and authorisation.

The organisation URL identifies the requested scope. Cross-tenant IDs return the same unavailable response as missing records. PostgreSQL composite foreign keys bind SiteAssignment and InvitationSite to matching organisation IDs. PostgreSQL row-level security is **not** claimed: service checks and relationship constraints are the enforcement layers in Sprint 1. Any future repository/query path must preserve these checks.

| Role | Organisation settings | Team and invitations | Site reads | Save baselines / analysis runs | Audit | Future billing |
|---|---|---|---|---|---|---|
| Owner | Yes | All roles | All organisation sites | Yes | Yes | Yes |
| Admin | Yes | Non-owners only; cannot grant Owner | All organisation sites | Yes | Yes | No |
| Analyst | No | No | All organisation sites | Yes | No | No |
| Site manager | No | No | Assigned sites only | No | No | No |
| Viewer | No | No | All organisation sites | No | No | No |

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

## Sprint 2 extension

Sites, portfolios and meters use organisation-scoped service checks and composite relationship foreign keys. Only Owner/Admin can write or import. Site Managers read assigned active sites and their meters/history; archive clears grants. Attribute history is append-only in PostgreSQL. Active-site quotas are enforced under the same organisation lock as imports and site creation.

Uploads are authenticated, origin-checked, byte-bounded and rate-limited before parsing. ZIP expansion, entries, dimensions and cell lengths are bounded; formulas, macros, external links and entity declarations are unsupported. Credential headers are normalized and removed with their entire columns before staging. The original bytes are transient. Staging and preview are accessible only to current Owner/Admin members of the batch organisation. Error downloads contain coordinates/field/reason, not source cell values. Import commit is transactional, revalidates all rows and supports safe retries. Production ingress limits and staging retention policy remain deployment requirements.


Advanced Analysis uses the dedicated `analysis:write` permission for Owner, Admin and Analyst. This implements the specification's Analyst models/NRA responsibility and the Sprint 1 design's analytical-work role. The service checks the current membership before fitting, saving or reusing any baseline/run. The page uses the same permission to show save controls. Viewer and Site Manager remain read-only for analysis; Site Managers also require assignment. Demotion/revocation is effective on the next request. Analysis writes do not grant organisation settings, membership, audit-feed, billing or source-data editing permissions. Source-data write policy remains separately enforced by the existing services. All numerical outputs remain UNVALIDATED.
