# AURIC — Project Guidelines

## Architecture and Data Integrity

- Gold transactions must be written only through role-checked SECURITY DEFINER RPCs (`create_gold_issue`, `create_gold_receipt`, `create_gold_adjustment`, `close_gold_issue`).
- Fine weight must always be calculated in PostgreSQL using `calc_fine_weight`: round(gross × purity / 100, 3), half away from zero. Client calculations are previews only.
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

## AI Photo Reading

- Photo extraction uses authenticated server functions and server-owned audit records.
- Human confirmation is required before extracted values are used in transactions.
- Photos must not be retained in storage.
- AI confidence defaults to `0.90` and can be configured using `PHOTO_CONFIDENCE_THRESHOLD`.
- AI credentials must remain server-side and must never be exposed in browser code or committed to Git.

## Environment and Deployment

- Supabase provides authentication and PostgreSQL.
- AI photo reading currently uses the Lovable AI Gateway.
- Keep credentials in secure environment configuration. Never commit `.env` files, API keys, service-role keys or database passwords.
- Do not claim the application is independent of managed services unless those integrations have actually been replaced and tested.
- Run relevant tests and a production build after making application changes.