-- AURIC database test suite.
-- Runs entirely inside one transaction and ALWAYS ends with RAISE EXCEPTION,
-- so every row it writes is rolled back. Nothing persists in the demo ledger
-- (only sequence values are consumed, which PostgreSQL never rolls back).
-- The final error message carries the results: "AURIC_TESTS pass=N fail=M | ...".
DO $$
DECLARE
  fin uuid; clerk uuid; nobody uuid := gen_random_uuid();
  kid uuid; cat uuid; iss public.gold_issues; iss2 public.gold_issues; rec public.gold_receipts;
  seed_issue uuid; out numeric; allowed numeric; excess numeric;
  pass int := 0; fail int := 0; log text := '';
  ok boolean; err text; n int; rid uuid := gen_random_uuid();
BEGIN
  SELECT user_id INTO fin FROM user_roles WHERE role = 'finance_head' LIMIT 1;
  SELECT user_id INTO clerk FROM user_roles WHERE role = 'issue_clerk' LIMIT 1;
  SELECT id INTO kid FROM karigars WHERE karigar_code = 'KG-001';
  SELECT id INTO cat FROM item_categories WHERE category_name = 'Necklace';
  SELECT id INTO seed_issue FROM gold_issues WHERE transaction_number = 'TX-30411';

  -- helper macro pattern: each block sets ok, then tallies
  -- 1-3 fine weight
  ok := calc_fine_weight(120.000, 91.60) = 109.920; IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL fine120 '; END IF;
  ok := calc_fine_weight(112.450, 91.60) = 103.004; IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL fine112 '; END IF;
  ok := calc_fine_weight(3.300, 91.60) = 3.023;     IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL fine3 '; END IF;

  -- 4 seeded balance
  out := issue_outstanding(seed_issue);
  ok := out = 3.893; IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL outstanding=' || out || ' '; END IF;

  -- 5-7 wastage on close (finance closes seeded issue inside this rolled-back txn)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  PERFORM close_gold_issue(seed_issue);
  SELECT expected_loss, actual_loss, excess_loss INTO allowed, out, excess FROM loss_alerts WHERE issue_id = seed_issue AND alert_type = 'excess_wastage';
  IF allowed = 3.298 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL allowed=' || coalesce(allowed::text,'null') || ' '; END IF;
  IF out = 3.893 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL actual ' ; END IF;
  IF excess = 0.595 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL excess '; END IF;

  -- 8 receipt against closed issue rejected
  BEGIN PERFORM create_gold_receipt(seed_issue, 'scrap', 0.100, 91.60, '', current_date, gen_random_uuid()); ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%closed%'; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL closed-receipt '; END IF;

  -- 9 closing twice cannot duplicate alerts
  BEGIN PERFORM close_gold_issue(seed_issue); EXCEPTION WHEN others THEN NULL; END;
  SELECT count(*) INTO n FROM loss_alerts WHERE issue_id = seed_issue;
  IF n = 1 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL dup-alert n=' || n || ' '; END IF;

  -- As clerk from here
  PERFORM set_config('request.jwt.claims', json_build_object('sub', clerk, 'role', 'authenticated')::text, true);
  iss := create_gold_issue(kid, cat, 'TEST-JOB', 10.000, 91.60, current_date, rid);
  IF iss.fine_weight = 9.160 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL clerk-issue '; END IF;

  -- 11 duplicate submission (same client_request_id) returns the same row
  iss2 := create_gold_issue(kid, cat, 'TEST-JOB', 10.000, 91.60, current_date, rid);
  SELECT count(*) INTO n FROM gold_issues WHERE client_request_id = rid;
  IF iss2.id = iss.id AND n = 1 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL idempotency '; END IF;

  -- 12 zero weight rejected
  BEGIN PERFORM create_gold_issue(kid, cat, 'J', 0, 91.60, current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL zero '; END IF;
  -- 13 negative weight rejected
  BEGIN PERFORM create_gold_issue(kid, cat, 'J', -5, 91.60, current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL negative '; END IF;
  -- 14-15 invalid purity rejected
  BEGIN PERFORM create_gold_issue(kid, cat, 'J', 5, 100.01, current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL purity>100 '; END IF;
  BEGIN PERFORM create_gold_issue(kid, cat, 'J', 5, 0, current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL purity0 '; END IF;
  -- 16 excessive decimals: column precision rounds to 3 dp, so 1.0004 is stored as 1.000 (never more than 3 dp)
  iss2 := create_gold_issue(kid, cat, 'J', 1.0004, 91.60, current_date, gen_random_uuid());
  IF iss2.gross_weight = 1.000 AND scale(iss2.gross_weight) = 3 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL decimals '; END IF;

  -- 17 over-receipt rejected
  BEGIN PERFORM create_gold_receipt(iss.id, 'jewellery', 11.000, 91.60, '', current_date, gen_random_uuid()); ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%exceeds outstanding%'; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL over-receipt '; END IF;

  -- 18 exact-balance receipt accepted, then any further receipt rejected
  rec := create_gold_receipt(iss.id, 'jewellery', 10.000, 91.60, '', current_date, gen_random_uuid());
  BEGIN PERFORM create_gold_receipt(iss.id, 'scrap', 0.001, 91.60, '', current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok AND issue_outstanding(iss.id) = 0 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL exact-balance '; END IF;

  -- 19 clerk cannot close issues / read finance RPCs / manage masters
  BEGIN PERFORM close_gold_issue(iss.id); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL clerk-close '; END IF;
  BEGIN PERFORM * FROM get_stock_statement(current_date - 7, current_date); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL clerk-stock '; END IF;
  BEGIN PERFORM save_item_category(cat, 'Necklace', 9.99, true); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL clerk-category '; END IF;
  BEGIN PERFORM save_karigar(NULL, 'KG-999', 'X', NULL, NULL); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL clerk-karigar '; END IF;

  -- 23 user with no role cannot write
  PERFORM set_config('request.jwt.claims', json_build_object('sub', nobody, 'role', 'authenticated')::text, true);
  BEGIN PERFORM create_gold_issue(kid, cat, 'J', 5, 91.60, current_date, gen_random_uuid()); ok := false; EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL norole '; END IF;

  -- 24 gold records cannot be edited or deleted (even by the table owner)
  BEGIN UPDATE gold_receipts SET gross_weight = 1 WHERE id = rec.id; ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL edit-receipt '; END IF;
  BEGIN DELETE FROM gold_issues WHERE id = iss.id; ok := false; EXCEPTION WHEN others THEN ok := true; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL delete-issue '; END IF;

  -- Finance: master data
  PERFORM set_config('request.jwt.claims', json_build_object('sub', fin, 'role', 'authenticated')::text, true);
  -- 26 category change does not alter historical issue wastage
  PERFORM save_item_category(cat, 'Necklace', 4.50, true);
  IF (SELECT allowed_wastage_percent FROM gold_issues WHERE id = iss.id) = 3.00 THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL history-wastage '; END IF;
  -- 27 category change is audited
  IF EXISTS (SELECT 1 FROM audit_logs WHERE entity_type = 'item_category' AND entity_id = cat AND action = 'update') THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL cat-audit '; END IF;
  -- 28 duplicate karigar code (case-insensitive) rejected
  BEGIN PERFORM save_karigar(NULL, 'kg-001', 'Dup', NULL, NULL); ok := false; EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%already exists%'; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL dup-code '; END IF;
  -- 29 karigar with history cannot be deleted
  BEGIN PERFORM delete_karigar(kid); ok := false; EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%history%'; END;
  IF ok THEN pass := pass + 1; ELSE fail := fail + 1; log := log || 'FAIL delete-history '; END IF;

  RAISE EXCEPTION 'AURIC_TESTS pass=% fail=% | %', pass, fail, CASE WHEN log = '' THEN 'all passed' ELSE log END;
END $$;
