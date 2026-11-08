# AURIC Staging Verification Report

**Verification date:** 2026-11-08 UTC
**Environment:** A **separate, isolated staging database** with its own sign-in accounts. The primary demonstration database was not used for any test transaction.

## Full workflow (actual result: passed)

| Step | Result |
| --- | --- |
| Issue Clerk authentication | Passed — signed in and reached clerk pages |
| AI photograph reading | Passed — live vision request returned the scale reading as a draft |
| Human confirmation | Passed — clerk reviewed and explicitly confirmed values before use |
| Gold issue creation | Passed — issue recorded through the database issue function |
| Jewellery receipt | Passed |
| Scrap receipt | Passed |
| Filings receipt | Passed |
| Final outstanding balance verification | Passed — balance read back from the database |

## Verified figures (fine gold)

| Entry | Fine weight |
| --- | ---: |
| Gold issued | 109.920 g |
| Jewellery returned | 103.004 g |
| Scrap returned | 3.023 g |
| Filings returned | 0.916 g |
| **Final outstanding** | **2.977 g** |

Calculation: 109.920 − 103.004 − 3.023 − 0.916 = **2.977 g**

All amounts were calculated by the database (NUMERIC, 3 decimal places, half away from zero), not by the browser or the AI.

## Additional verification

- 38 unit tests passed (0 failed).
- 22 permission and validation checks passed.
- Security check (basic and deep scan) reported no issues.
- The existing demonstration database remained unchanged.
- No new demo records were created.
- No application changes were made during staging verification.

## Not covered by this verification

- Job closure workflow.
- Successful concurrent-transaction stress/load testing.
- Photographs from real physical cameras and real scales/karat meters.
