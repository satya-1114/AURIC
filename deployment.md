# AURIC Deployment Guide

No credentials, secret values or deployment URLs appear in this document.

## 1. Prerequisites

- Node.js (LTS) and Bun.
- A Supabase project (database + auth) per environment: development, isolated staging, production.
- Access to an AI gateway key for the vision model.
- Git access to the repository.

## 2. Local installation

1. Clone the repository.
2. `bun install --frozen-lockfile`
3. Copy `.env.example` to `.env` and fill in values for your environment.
4. `bun run dev` and open the printed local address.
5. Confirm `.env` is not tracked (`git ls-files .env` returns nothing).

## 3. Environment variable names

| Name | Scope | Purpose |
| --- | --- | --- |
| VITE_SUPABASE_URL | Browser (public) | Backend address |
| VITE_SUPABASE_PUBLISHABLE_KEY | Browser (public) | Publishable key; RLS still applies |
| VITE_SUPABASE_PROJECT_ID | Browser (public) | Project identifier |
| SUPABASE_URL | Server | Backend address for server functions |
| SUPABASE_PUBLISHABLE_KEY | Server | Authenticated server client |
| SUPABASE_SERVICE_ROLE_KEY | Server secret | Privileged audit writes only; never in browser |
| LOVABLE_API_KEY | Server secret | AI vision gateway credential |
| PHOTO_CONFIDENCE_THRESHOLD | Server, optional | 0–1, default 0.90 |
| AURIC_CLERK_PASSWORD / AURIC_FINANCE_PASSWORD | Test process only | API permission test script |

## 4. Supabase configuration

- One project per environment; never share a database between staging and production.
- Enable email/password auth; disable anonymous sign-ups; keep email confirmation on.
- Set the auth Site URL and redirect URLs to the real deployed origin once known.

## 5. Database migrations

- Apply all versioned migrations in recorded order with the managed migration process (`supabase db push` or equivalent).
- Never edit or regenerate applied migrations.
- After applying, confirm RLS is enabled and grants are in place on every application table.

## 6. Authentication setup

- Staff sign in with email and password created through trusted auth administration.
- No self-registration path should grant roles.

## 7. Role assignment

Insert a row into `public.user_roles` (`issue_clerk` or `finance_head`) for each user using an administrative database session. Never store roles in profile metadata.

## 8. Demo account creation

1. Create one Issue Clerk and one Finance Head user via auth administration with unique, securely generated passwords.
2. Assign their roles as in section 7.
3. Share passwords through a secure channel only; never in source, seeds or docs.
4. Rotate any previously shared demo passwords before real use.

## 9. AI server configuration

- Set `LOVABLE_API_KEY` as a server secret; optionally set `PHOTO_CONFIDENCE_THRESHOLD`.
- The key is read only inside server handlers. Photos are not stored.
- If AI access fails terminally, a Finance Head resumes it from the app after access is restored.

## 10. Local testing

- `bunx vitest run` — unit and AI-mock tests.
- `tests/db/*.test.sql` — run against a non-production database; each ends in a rollback exception by design.
- `tests/api/permissions.sh` — needs the test password variables; attempts only writes expected to be refused.
- `bun run build` — production build check.

## 11. Deployment

1. Confirm staging results and owner approval.
2. Apply migrations to the production database.
3. Set production server secrets.
4. Publish the approved build. Code rollback does not undo migrations or transactions.
5. Record the real deployment URL only after success.

## 12. Post-deployment checks

- Sign in as each role; verify page access and sign-out.
- Confirm Clerk cannot see stock or loss data.
- Test a real scale/karat-meter photo, confirmation, rejection and mismatch block.
- Verify balances read back correctly; perform ledger writes only for real jobs.
- Confirm backups exist and a recovery procedure is documented.

## 13. Security requirements

- Never commit `.env`; add a literal `.env` line to `.gitignore`.
- Service-role and AI keys stay server-side only.
- Keep RLS and role checks intact; gold records stay immutable; corrections use adjustments.
- Review security scan results before every release.
