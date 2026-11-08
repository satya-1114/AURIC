# AURIC photo readings

## Implemented
- Read from Photo in both transaction dialogs; device selection and mobile camera capture.
- Original-photo preview beside extracted values on desktop, stacked on mobile.
- Scale and karat-meter extraction through an authenticated, role-checked vision call. Missing, ambiguous and invalid fields remain null; karat is not converted to purity.
- Human confirmation, manual correction with a reason, rejection, and explicit use of confirmed values. Existing form values are not silently changed.
- Confirmed-photo discrepancies block form review and are independently rejected by a database INSERT guard linked to the transaction request. The existing gold calculation functions and transaction RPCs are unchanged.
- Server validates actual bytes, MIME, size and dimensions. JPEG/PNG/WebP, up to 5 MB; 100–6000 pixels per side, at most 12 megapixels.
- Photographs are never stored in buckets or audit records. Only extraction, user, timestamps, status, reason and transaction link are retained. Original photographs exist in browser memory during the form session.
- Confidence defaults to 90%; server configuration `PHOTO_CONFIDENCE_THRESHOLD` accepts 0–1 and each analysis records the effective threshold.
- Terminal AI access blocks persist; Finance Head can explicitly resume after access restoration. No automatic retries or guessed fallback readings.

## Executed validation
- Full Vitest suite: **38 passed**, including 20 photo-safeguard/image-validation tests and existing gold tests.
- Rollback-only database suite: **12 passed, 0 failed**, reported through its deliberate final exception. Covered draft rejection, mismatch, verified issue and receipt creation, unchanged fine calculations, linkage, idempotency, consumed-reading protection, low confidence, correction reason, precision and unauthorized verification.
- Verified rollback: **0 PHOTO-ROLLBACK issues**, ledger still **1 issue and 2 receipts**, TX-30411 fine weight **109.920 g**.
- Real vision requests through the authenticated Issue Clerk UI successfully extracted **120.000 g** from a synthetic scale-display fixture and **91.60% / 22 K** from a synthetic karat-result fixture. These are test images, not real instrument photographs.
- Browser confirmed human verification, explicit form population, **121.000 g versus 120.000 g blocking**, correction reason enforcement, rejection and the normal receipt confirmation screen. The permanent Record receipt button was intentionally not pressed.
- Desktop 1280 px, tablet 820 px and mobile 390 px screenshots inspected; tested photo dialog had no horizontal overflow.
- Signed-out analysis refused. Direct authenticated reading mutations refused with HTTP **403** after explicit grant hardening. Browser-returned extraction/status cannot write the audit directly.
- Changed application files pass ESLint. Full-project ESLint ran but reports **803 formatting errors in integration-managed generated files**, plus **7 existing fast-refresh warnings**; generated files were not manually reformatted.
- Latest automatic compilation/type validation: **build OK**.

## Remaining limitations
- Real-world accuracy across actual instrument models, glare, blur and printed slips needs client photograph testing. Confidence is a model estimate, not a certified measurement.
- Physical camera hardware capture was not tested; browser mobile capture controls were inspected.
- Ledger creation was exercised in rolled-back database transactions, not a permanent end-to-end browser write, to preserve demonstration history.
- Original photographs are intentionally unavailable after leaving/reloading the form; the extraction and verification audit remains.
- A connection interruption after the server records an analysis can leave a draft audit for that request; the database safely blocks the request rather than guessing or silently ignoring it. A new form session starts a new request.
- No load/concurrency stress test or published-environment verification was performed.

Implementation follows the **AI SDK gateway** workflow with Responses structured vision output.