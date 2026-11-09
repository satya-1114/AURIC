# AURIC

**Gold Operations & Karigar Management System**

AURIC tracks gold entrusted to workshop karigars, returned jewellery, scrap and filings, outstanding fine-gold balances, and finance review items. Authoritative calculations and authorization remain in the database; photographed instrument readings require human verification.

## Core capabilities

- Gold issues with karigar, category, job, gross weight, purity and issue date.
- Jewellery, scrap and filings receipts against open issues.
- Immutable transaction history, idempotent submissions and audited adjustments.
- Karigar search, profile management and active/inactive status.
- Category wastage configuration; issues retain their original agreed limit.
- Finance dashboard, balances, closed-job wastage reviews and stock CSV reports.
- AI scale/karat-meter transcription with photo preview, confidence, manual correction, rejection and mismatch protection.
- Role-aware navigation, responsive tables, validation, confirmations and error states.

## Architecture

React 19 and TypeScript run on TanStack Start with file-based routing, TanStack Query and Tailwind CSS. Cloudflare Workers provide the application runtime through the Cloudflare Vite plugin and Wrangler.

Supabase provides authentication and PostgreSQL. PostgreSQL NUMERIC, row-level security and role-checked SECURITY DEFINER RPCs own ledger operations. Authenticated server functions use Google Gemini 3.8 Flash for AI-assisted photo transcription through a server-side API key.

## Managed service dependencies

The Cloudflare deployment uses the independently created Supabase project for authentication and PostgreSQL, and Google Gemini for AI photo reading.

The original Lovable deployment and its managed backend are retained separately as a backup. The Cloudflare deployment must use the new Supabase project, not the original Lovable-managed backend.

## Application roles

| Role | Access |
| --- | --- |
| Issue Clerk | Karigar records, issue/receipt creation, transaction history and photo readings |
| Finance Head | Clerk capabilities plus dashboard, finance balances, loss reviews, stock reports, audited master configuration and AI access recovery |

Roles are stored separately in `user_roles`, never trusted from editable profile metadata. Route guards improve navigation; database permissions and RPC checks enforce access.

## Database overview

`profiles` and `user_roles` represent staff identity and access. `karigars` and `item_categories` define masters. `gold_issues`, `gold_receipts` and `gold_adjustments` form the ledger. `loss_alerts`, `loss_settings` and `audit_logs` support finance controls. `photo_readings` stores extraction and verification audit data; `photo_ai_access` persists terminal AI access pauses.

Versioned SQL migrations are in `drizzle/migrations`.

Fine weight is calculated as:

`round(gross_weight * purity_percent / 100, 3)`

PostgreSQL NUMERIC performs the authoritative calculation using half-away-from-zero rounding. Weights display to three decimals; purity displays to two. Browser calculations are previews only.

## AI workflow

Photograph → authenticated analysis → nullable extracted readings → human verification → explicit form population → normal transaction confirmation → database validation → ledger.

AI transcribes visible instrument readings; it does not determine fine gold or balances. JPEG, PNG and WebP uploads are validated server-side. Low-confidence or edited values require a verification reason. Confirmed-photo discrepancies block submission. Photographs remain transient; they are not uploaded to public storage or retained in audit rows.

AI credentials remain server-side. Human confirmation is mandatory before extracted values are used in a transaction.

## Local development

1. Clone the repository.
2. Install the required Bun version.
3. Run `bun install --frozen-lockfile`.
4. Copy `.env.example` to `.env` and configure the public Supabase browser variables.
5. Configure server-only local variables in `.dev.vars`. See `deployment.md`.
6. Run `bun run dev` and open the address printed by Vite.

Use a separate staging backend for tests that create records. Never point disposable transaction tests at the primary demonstration ledger.

## Testing

```sh
bun run test
bun run lint
bun run build


- `src/lib/gold-math.test.ts`: fine weight, balances, wastage and validation.
- `src/lib/photo-reading.test.ts` and `photo-image.test.ts`: mocked AI safety and server upload validation.
- `src/test/app-routing.test.tsx`: route matching; not a substitute for authenticated role checks.
- `tests/db/*.test.sql`: execute through an authorized database test runner. Each suite deliberately raises its final result to roll back all changes. A final exception reporting zero failures is expected; sequence increments do not roll back.
- `tests/api/permissions.sh`: existing demo-account permission checks; requires credentials supplied securely at execution, never committed. Run only after verifying every mutation is expected to be refused. Its concurrent over-receipts do not prove locking under successful concurrent writes.

A successful local build is not proof of a successful production deployment. Verify the deployed Worker, authentication, database permissions, AI integration and critical workflows separately.

## Deployment and security

See [deployment.md](deployment.md) for environment separation, Cloudflare deployment, demo-account provisioning and post-deployment checks.

See [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md) for transaction and security design, and [RELEASE_READINESS.md](RELEASE_READINESS.md) for executed evidence and blockers.

- Do not commit `.env`, `.dev.vars`, database passwords, service-role credentials or AI keys.
- Never prefix a private credential with `VITE_`; those values ship to browsers.
- Preserve RLS, explicit grants, role checks, audit trails and immutable ledger triggers.
- Apply schema changes additively; do not rewrite applied migrations or historical transactions.
- Demo category percentages are illustrative, not confirmed client settings.
- Production release requires real-instrument acceptance testing, isolated workflow verification and deployment-environment validation.
