# AURIC — Project Guidelines

## Architecture and Data Integrity

- The application uses React, TypeScript, TanStack Start, the Cloudflare Vite plugin and Wrangler.
- Supabase provides authentication and PostgreSQL.
- Gold transactions must be written only through role-checked SECURITY DEFINER RPCs (`create_gold_issue`, `create_gold_receipt`, `create_gold_adjustment`, `close_gold_issue`).
- Fine weight must always be calculated in PostgreSQL using `calc_fine_weight`: round(gross * purity / 100, 3), half away from zero. Client calculations are previews only.
- Gold transaction rows are immutable. Corrections must use gold adjustments.
- Roles are stored in `public.user_roles` (`issue_clerk`, `finance_head`), never on profiles.
- Finance-only data must be enforced through RLS and RPC checks. UI layouts are not security boundaries.
- Master data changes must use finance-authorized audited RPCs. Karigar codes are immutable after creation.

## Routing and UI

- Signed-in pages live under `src/routes/_authenticated/`.
- The authenticated layout renders the application shell.
- `/` redirects according to the authenticated user's role.
- TanStack Start uses file-based routing.
- `src/routes/__root.tsx` is the root layout. Preserve `<Outlet />`.
- `routeTree.gen.ts` is generated automatically. Do not edit it manually.
- Mobile tables should render as cards through `DataTable` rather than requiring horizontal scrolling.

## Database and Testing

- Database tests live in `tests/db/*.test.sql`.
- Database test blocks must roll back their writes and must never modify demo ledger data.
- API permission tests in `tests/api/permissions.sh` must only attempt writes expected to be refused.
- Do not edit generated files manually.
- Preserve existing database security policies, transaction immutability and audit behavior.
- Applied migrations are historical records. Do not rewrite them to change an existing database; create a new migration for schema changes.

## AI Photo Reading

- Photo extraction uses authenticated server functions and server-owned audit records.
- Google Gemini 3.8 Flash is the configured AI model.
- Human confirmation is required before extracted values are used in transactions.
- Photos must not be retained in storage.
- AI confidence defaults to `0.90` and can be configured using `PHOTO_CONFIDENCE_THRESHOLD`.
- AI credentials must remain server-side and must never be exposed in browser code or committed to Git.
- AI must transcribe visible readings only. It must not calculate fine gold or transaction balances.
- Low-confidence, edited or ambiguous readings must follow the existing verification and rejection safeguards.

## Environment and Deployment

- Supabase provides authentication and PostgreSQL for the Cloudflare deployment.
- Cloudflare Workers provide the application runtime.
- Wrangler manages Worker deployment and server-side secrets.
- Google Gemini provides AI photo-reading functionality.
- Use `.env` for local public browser configuration and `.dev.vars` for local server-only secrets.
- Production server secrets must be configured through Cloudflare Worker secrets.
- Never commit `.env` files, `.dev.vars`, API keys, service-role keys or database passwords.
- Never put private credentials in `VITE_` variables.
- The original Lovable deployment is retained as a separate backup. Do not accidentally reconnect the Cloudflare deployment to its old backend.
- Do not claim a deployment is production-ready until its deployed configuration and critical workflows have been verified.
- Run relevant tests, linting and a production build after application changes.
