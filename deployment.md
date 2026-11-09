# AURIC Deployment Guide

AURIC uses Cloudflare Workers for hosting, Supabase for authentication and PostgreSQL, and Google Gemini for AI-assisted scale-photo reading.

The original Lovable deployment is retained separately as a backup. The Cloudflare deployment must use the new Supabase project, not the original Lovable-managed backend.

## 1. Architecture

| Component | Service |
| --- | --- |
| Frontend and server runtime | Cloudflare Workers |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Supabase roles and Row Level Security |
| AI photo reading | Google Gemini (`gemini-3.8-flash`) |
| Package manager | Bun |

## 2. Prerequisites

- Git
- Bun
- A Cloudflare account with Workers access
- A Supabase project
- A Google AI Studio API key
- Access to the AURIC GitHub repository

## 3. Local installation

1. Clone the repository.
2. Install dependencies:

   `bun install --frozen-lockfile`

3. Copy `.env.example` to `.env`.
4. Configure the public Supabase values in `.env`.
5. Create a local `.dev.vars` file for server-only credentials.
6. Start the development server:

   `bun run dev`

7. Verify the application and authentication.

Never commit `.env` or `.dev.vars`.

## 4. Environment variables

### Public browser configuration

| Variable | Purpose |
| --- | --- |
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Supabase publishable key |
| VITE_SUPABASE_PROJECT_ID | Supabase project identifier |

These values are public browser configuration. Database access must remain protected by RLS and application authorization.

### Server configuration

| Variable | Purpose |
| --- | --- |
| SUPABASE_URL | Supabase server connection |
| SUPABASE_PUBLISHABLE_KEY | Authenticated Supabase client |
| SUPABASE_SERVICE_ROLE_KEY | Privileged server-side operations |
| GEMINI_API_KEY | Gemini photo-reading API access |
| PHOTO_CONFIDENCE_THRESHOLD | Optional confidence threshold; default 0.90 |

The service-role key bypasses normal RLS protections. It must only be used in trusted server-side code.

Never expose service-role or Gemini credentials through browser code or VITE_ variables.

## 5. Supabase database setup

Use a separate Supabase project for each environment.

The staging project for this migration is:

- Project: `auric-staging`
- Region: South Asia (Mumbai)

The five application migrations are stored in `drizzle/migrations/`:

1. `0000_auric_core_schema.sql`
2. `0001_revoke_direct_writes.sql`
3. `0002_masters_and_trend_monitoring.sql`
4. `0003_verified_photo_readings.sql`
5. `0004_restrict_photo_reading_grants.sql`

For the current staging project, these migrations have already been applied sequentially through the Supabase SQL Editor.

For a fresh environment:
- Review each migration.
- Apply them in the recorded order.
- Verify tables, RLS policies, grants, functions and triggers.
- Do not regenerate or modify migrations that have already been applied.

The Drizzle schema file is intentionally blank. Do not use `drizzle-kit generate` to recreate the existing schema.

## 6. Authentication and roles

Staff accounts must be created through trusted Supabase Auth administration.

Supported application roles:

- `issue_clerk`
- `finance_head`

Assign roles through `public.user_roles` using an administrative database session.

Do not grant application roles through user-editable profile metadata.

Disable public self-registration unless a reviewed registration workflow is implemented.

## 7. Demo accounts

Create separate Issue Clerk and Finance Head accounts for staging.

1. Create users through Supabase Auth administration.
2. Assign their roles in `public.user_roles`.
3. Use unique passwords.
4. Never store passwords in source code, SQL seeds, documentation or Git.
5. Do not reuse previously shared demo credentials for production.

## 8. Gemini configuration

AURIC uses Google's Gemini API with the `gemini-3.8-flash` model for photo transcription.

Configure `GEMINI_API_KEY` as a server-side secret.

The AI extracts visible readings; it does not independently authorize or save gold transactions.

Human verification remains mandatory. Unreadable or ambiguous values must not be guessed.

The optional `PHOTO_CONFIDENCE_THRESHOLD` defaults to `0.90`.

Gemini free-tier quotas and data-use terms may differ from paid-tier terms. Use synthetic test images until the applicable data-handling terms have been reviewed. Do not submit real customer documents or confidential financial information without approval.

## 9. Local server secrets

Use `.dev.vars` for local Cloudflare development.

Keep server credentials in that file and never commit it.

Do not copy private credentials into `.env.example`, frontend code or source control.

## 10. Cloudflare setup

1. Authenticate Wrangler:

   `bunx wrangler login`

2. Verify the account:

   `bunx wrangler whoami`

3. Configure the required public build variables in the Cloudflare build environment:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

4. Configure the server secrets using Wrangler:

   `bunx wrangler secret put SUPABASE_URL`

   `bunx wrangler secret put SUPABASE_PUBLISHABLE_KEY`

   `bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`

   `bunx wrangler secret put GEMINI_API_KEY`

5. Deploy only after the staging checks pass:

   `bun run deploy`

Never place private secrets in Wrangler configuration files or GitHub.

## 11. Validation before deployment

Run:

- `bunx tsc --noEmit`
- `bun run test`
- `bun run build`
- `bunx wrangler deploy --dry-run`

Verify:
- TypeScript compilation succeeds.
- All automated tests pass.
- Production build succeeds.
- Wrangler dry-run succeeds.
- The deployed environment uses the intended Supabase project.
- No private credentials are included in generated browser assets.

## 12. Post-deployment verification

After deployment:

1. Sign in as an Issue Clerk.
2. Sign in as a Finance Head.
3. Verify role-specific access and sign-out.
4. Confirm the Issue Clerk cannot access restricted stock and loss information.
5. Verify gold issue and receipt calculations to three decimal places.
6. Verify running balances and loss alerts.
7. Test photo reading using synthetic images.
8. Confirm manual verification and mismatch blocking.
9. Verify audit records and daily stock statements.
10. Confirm backups and a recovery procedure.

Do not use real gold transactions for initial deployment testing.

## 13. Security requirements

- Never commit `.env`, `.dev.vars` or private credentials.
- Keep service-role and Gemini API keys server-side.
- Preserve RLS, database grants and application role checks.
- Keep gold ledger records immutable.
- Use authorized adjustment workflows for corrections.
- Review security and access controls before production use.

## 14. Deployment status

The Cloudflare configuration and migration are being prepared on the `deploy/cloudflare` branch.

A successful local build or Wrangler dry-run does not mean the application has been deployed.

Record the actual Cloudflare deployment URL only after a successful deployment and post-deployment verification.
