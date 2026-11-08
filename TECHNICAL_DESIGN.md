# AURIC — Technical Design Document

**GitHub Repository:** [PLACEHOLDER - OWNER WILL PROVIDE]

**Live Application:** [PLACEHOLDER - ADD ONLY AFTER DEPLOYMENT]

*Gold Operations & Karigar Management System — version prepared 2026-11-08*

---

## 1. Architecture overview

AURIC tracks gold entrusted to karigars (goldsmiths): what was issued, what came back as jewellery, scrap or filings, and what is still outstanding. Every authoritative figure is computed and enforced in the database.

```text
Browser (React, TanStack Router/Query)
  |-- Authenticated reads ............ protected by Row Level Security
  |-- Ledger writes .................. role-checked database functions (RPCs)
  '-- Photo reading .................. authenticated server functions
         |-- image validation (type, size, dimensions)
         |-- server-only AI vision request
         '-- server-owned extraction audit
PostgreSQL: NUMERIC maths, constraints, immutability triggers, RLS, audit log
```

Browser role checks only shape navigation; security is enforced by the database and server.

## 2. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TanStack Start v1 (Router, Query), TypeScript |
| Build / styling | Vite 7, Tailwind CSS v4, shadcn/ui components |
| Server runtime | TanStack server functions on an edge (Worker) runtime |
| Database | PostgreSQL (Supabase) with RLS |
| Authentication | Supabase Auth (email and password) |
| AI vision | Server-side vision model via an AI gateway (structured output) |
| Testing | Vitest, rollback-only SQL tests, API permission script |

## 3. Database design

| Table | Purpose |
| --- | --- |
| profiles | Staff display name |
| user_roles | Role membership (`issue_clerk`, `finance_head`), kept separate from profiles |
| karigars | Code (immutable), name, phone, preferred language, active status |
| item_categories | Category and configurable allowed wastage % |
| gold_issues | Job, karigar, category, gross weight (12,3), purity (5,2), fine weight (12,3), agreed wastage %, status, request ID |
| gold_receipts | Jewellery / scrap / filings return against an issue; optional HUID |
| gold_adjustments | Auditable corrections (no silent edits) |
| loss_alerts, loss_settings | Deduplicated review items and configurable thresholds |
| audit_logs | Who did what, to which record, when |
| photo_readings, photo_ai_access | Photo extraction audit and AI access pause state |

Integrity: unique transaction numbers and karigar codes; foreign keys; positive weights; purity 0–100; non-negative wastage; idempotency via `client_request_id`; gold rows cannot be updated or deleted (only issue status/closure fields may change).

## 4. Authentication and authorization

- Email/password sign-in; signed-in pages sit behind an authenticated layout; `/` redirects by role.
- **Issue Clerk:** view karigars and transactions, create issues and receipts, use photo reading. No stock or loss data.
- **Finance Head:** full dashboard, balances, loss review, stock statement and export, master data management.
- Enforcement: RLS on all application tables, SELECT-only client access to gold tables, role checks inside every write function and server handler. Roles are never read from user-editable metadata.

## 5. Karigar management

Finance Head can add karigars, edit permitted profile fields, activate/deactivate, search by name or code, and filter by status. Outstanding balance and preferred language are shown. Duplicate codes are rejected; karigars with transaction history cannot be deleted. All changes are audited.

## 6. Gold issue and receipt lifecycle

1. Clerk selects an active karigar and category (issue) or an open issue (receipt).
2. Enters gross weight and purity, optionally from a confirmed photo reading.
3. Form validates precision and ranges and shows a confirmation dialog.
4. `create_gold_issue` / `create_gold_receipt` is called with a request ID.
5. Database checks role, master data and status; receipts lock the issue and reject fine gold above outstanding; closed issues reject receipts.
6. Fine weight, transaction and audit rows are written atomically; balances are read back from the database.

Each issue stores its agreed wastage % at creation, so later category changes never alter history.

## 7. Fine-gold calculations

**Rule:** Fine Weight = Gross Weight × Purity ÷ 100, rounded to **3 decimal places, half away from zero**, by PostgreSQL `calc_fine_weight` on NUMERIC values. JavaScript values are previews only.

| Example | Result |
| --- | ---: |
| 120.000 g × 91.60% | 109.920 g |
| 112.450 g × 91.60% | 103.004 g |
| 3.300 g × 91.60% | 3.023 g |
| 1.000 g × 91.60% (filings, staging) | 0.916 g |

Demo ledger outstanding: 109.920 − 103.004 − 3.023 = 3.893 g. At an illustrative 3.00% wastage: allowed 3.298 g, actual 3.893 g, excess 0.595 g.

## 8. AI image extraction

Clerks may photograph a scale or karat-meter display. The server validates the image (JPEG/PNG/WebP, max 5 MB, 100–6000 px per side, max 12 MP) and asks the vision model for gross weight, displayed unit, purity, karat, confidence and warnings. Unclear fields stay empty; purity is never derived from karat and units are never converted. Photos are not stored permanently; the extraction audit is kept. AI never calculates ledger amounts.

## 9. Human verification

Extracted values are drafts. The clerk must review and explicitly confirm them before they fill the form. Low confidence (below the configurable threshold, default 0.90), warnings, missing values or edits require a written verification reason. The usual transaction confirmation still follows.

## 10. Mismatch prevention

A database guard linked to the transaction request requires every non-rejected photo reading to be confirmed and to match the submitted weight and purity. A mismatch (for example 121.000 g submitted against a confirmed 120.000 g) blocks the transaction. Readings are consumed once and cannot be reused.

## 11. Historical loss detection

For closed jobs, AURIC compares each karigar's recent wastage with their own historical average using configurable thresholds, and flags rising trends with karigar, trend, percentage and excess fine gold. Alerts are deduplicated and worded as **review items, not accusations**. Finance Head only. No history is fabricated; with little closed-job data, few or no items appear.

## 12. Stock reporting

Finance Head sees outstanding balances per karigar and a daily stock statement exportable as CSV. Clerks cannot read stock data (enforced in the database).

## 13. Audit logging

Every ledger write, master data change, setting change, alert review and photo extraction/verification writes an audit record with user, action, entity and time. Audit rows are written by the server/database, not the browser.

## 14. Testing evidence

**Isolated staging verification (separate database), 2026-11-08 — passed:**

Issue Clerk sign-in → AI photo reading → human confirmation → issue → jewellery, scrap and filings receipts → balance readback.

| Entry | Fine weight |
| --- | ---: |
| Gold issued | 109.920 g |
| Jewellery returned | 103.004 g |
| Scrap returned | 3.023 g |
| Filings returned | 0.916 g |
| **Final outstanding** | **2.977 g** |

109.920 − 103.004 − 3.023 − 0.916 = 2.977 g

- 38 unit tests passed; 22 permission and validation checks passed.
- Security check reported no issues.
- Demonstration database unchanged; no new demo records; no application changes.
- Earlier rollback-only SQL tests covered zero/negative weights, invalid purity, excess decimals, over-receipts, closed issues, unauthorized writes and duplicate submissions.

## 15. Assumptions and illustrative data

- Category wastage (Necklace 3.00%, Bangles 2.50%, Rings 2.00%, Earrings 2.75%, Chains 1.50%) is **illustrative**, not confirmed client data.
- Karigar phone numbers and the demo transactions (TX-30411, TX-30437, TX-30438) are **demo data**.
- The filings receipt (0.916 g) exists only in the staging database.
- AI accuracy was tested on synthetic images, not certified instruments.

## 16. Known limitations

- Job closure not tested.
- Successful concurrent transaction stress testing not completed.
- Real physical camera photographs not tested.
- Generated integration lint errors remain.
- Production deployment not completed.
- Adjustment management UI remains incomplete.
- Category wastage percentages remain illustrative.

## 17. Future improvements

- Adjustment management screen with approval workflow.
- Real-device photo acceptance testing across scales, glare and lighting.
- Load and concurrency testing.
- Job closure acceptance tests and closed-job reporting.
- CI pipeline with lint policy for generated files.
- Old-gold purchasing and Tally export (deliberately out of scope so far).
