-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('issue_clerk', 'finance_head');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles live in their own table (never on profiles) to prevent privilege escalation.
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "Own profile readable" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'finance_head'));
CREATE POLICY "Own profile editable" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Masters =====
CREATE TABLE public.karigars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  karigar_code text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  phone text,
  preferred_language text,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.karigars TO authenticated;
GRANT ALL ON public.karigars TO service_role;
ALTER TABLE public.karigars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read karigars" ON public.karigars FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  allowed_wastage_percent numeric(5,2) NOT NULL CHECK (allowed_wastage_percent >= 0 AND allowed_wastage_percent <= 100),
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.item_categories TO authenticated;
GRANT ALL ON public.item_categories TO service_role;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read categories" ON public.item_categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== Transactions (insert-only through RPC functions) =====
CREATE SEQUENCE public.gold_tx_seq START 30500;

CREATE TABLE public.gold_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL UNIQUE,
  karigar_id uuid NOT NULL REFERENCES public.karigars(id),
  job_number text NOT NULL,
  item_category_id uuid NOT NULL REFERENCES public.item_categories(id),
  gross_weight numeric(12,3) NOT NULL CHECK (gross_weight > 0),
  purity_percent numeric(5,2) NOT NULL CHECK (purity_percent > 0 AND purity_percent <= 100),
  fine_weight numeric(12,3) NOT NULL CHECK (fine_weight > 0),
  allowed_wastage_percent numeric(5,2) NOT NULL CHECK (allowed_wastage_percent >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  issue_date date NOT NULL DEFAULT current_date,
  client_request_id uuid UNIQUE,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_issues_karigar ON public.gold_issues(karigar_id);
CREATE INDEX idx_issues_date ON public.gold_issues(issue_date);
GRANT SELECT ON public.gold_issues TO authenticated;
GRANT ALL ON public.gold_issues TO service_role;
ALTER TABLE public.gold_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read issues" ON public.gold_issues FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.gold_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL UNIQUE,
  issue_id uuid NOT NULL REFERENCES public.gold_issues(id),
  karigar_id uuid NOT NULL REFERENCES public.karigars(id),
  receipt_type text NOT NULL CHECK (receipt_type IN ('jewellery','scrap','filings')),
  gross_weight numeric(12,3) NOT NULL CHECK (gross_weight > 0),
  purity_percent numeric(5,2) NOT NULL CHECK (purity_percent > 0 AND purity_percent <= 100),
  fine_weight numeric(12,3) NOT NULL CHECK (fine_weight > 0),
  huid text CHECK (huid IS NULL OR huid ~ '^[A-Z0-9]{6}$'),
  receipt_date date NOT NULL DEFAULT current_date,
  client_request_id uuid UNIQUE,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_issue ON public.gold_receipts(issue_id);
CREATE INDEX idx_receipts_karigar ON public.gold_receipts(karigar_id);
CREATE INDEX idx_receipts_date ON public.gold_receipts(receipt_date);
GRANT SELECT ON public.gold_receipts TO authenticated;
GRANT ALL ON public.gold_receipts TO service_role;
ALTER TABLE public.gold_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read receipts" ON public.gold_receipts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Corrections are new signed records, never edits.
CREATE TABLE public.gold_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL UNIQUE,
  karigar_id uuid NOT NULL REFERENCES public.karigars(id),
  issue_id uuid REFERENCES public.gold_issues(id),
  fine_weight_delta numeric(12,3) NOT NULL CHECK (fine_weight_delta <> 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  client_request_id uuid UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gold_adjustments TO authenticated;
GRANT ALL ON public.gold_adjustments TO service_role;
ALTER TABLE public.gold_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read adjustments" ON public.gold_adjustments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance_head'));

CREATE TABLE public.loss_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  karigar_id uuid NOT NULL REFERENCES public.karigars(id),
  issue_id uuid REFERENCES public.gold_issues(id),
  alert_type text NOT NULL,
  expected_loss numeric(12,3) NOT NULL CHECK (expected_loss >= 0),
  actual_loss numeric(12,3) NOT NULL,
  excess_loss numeric(12,3) NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_status ON public.loss_alerts(status);
GRANT SELECT ON public.loss_alerts TO authenticated;
GRANT ALL ON public.loss_alerts TO service_role;
ALTER TABLE public.loss_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read alerts" ON public.loss_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance_head'));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance_head'));

-- ===== Immutability =====
CREATE OR REPLACE FUNCTION public.block_gold_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Gold transactions cannot be deleted; record an adjustment instead';
  END IF;
  -- Only issue closure (status/closed_at) may change on gold_issues.
  IF TG_TABLE_NAME = 'gold_issues'
     AND (to_jsonb(NEW) - 'status' - 'closed_at') = (to_jsonb(OLD) - 'status' - 'closed_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Gold transactions cannot be edited; record an adjustment instead';
END $$;
CREATE TRIGGER no_mutation_issues BEFORE UPDATE OR DELETE ON public.gold_issues FOR EACH ROW EXECUTE FUNCTION public.block_gold_mutation();
CREATE TRIGGER no_mutation_receipts BEFORE UPDATE OR DELETE ON public.gold_receipts FOR EACH ROW EXECUTE FUNCTION public.block_gold_mutation();
CREATE TRIGGER no_mutation_adjustments BEFORE UPDATE OR DELETE ON public.gold_adjustments FOR EACH ROW EXECUTE FUNCTION public.block_gold_mutation();

-- ===== Authoritative calculation =====
-- Fine weight = gross × purity / 100, computed in NUMERIC and rounded to 3 dp
-- with ROUND HALF AWAY FROM ZERO (PostgreSQL numeric round()). Client values are ignored.
CREATE OR REPLACE FUNCTION public.calc_fine_weight(_gross numeric, _purity numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round(_gross * _purity / 100, 3)
$$;

CREATE OR REPLACE FUNCTION public.set_fine_weight()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.fine_weight := public.calc_fine_weight(NEW.gross_weight, NEW.purity_percent);
  RETURN NEW;
END $$;
CREATE TRIGGER fine_weight_issues BEFORE INSERT ON public.gold_issues FOR EACH ROW EXECUTE FUNCTION public.set_fine_weight();
CREATE TRIGGER fine_weight_receipts BEFORE INSERT ON public.gold_receipts FOR EACH ROW EXECUTE FUNCTION public.set_fine_weight();

CREATE OR REPLACE FUNCTION public.issue_outstanding(_issue_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.fine_weight
    - COALESCE((SELECT sum(r.fine_weight) FROM public.gold_receipts r WHERE r.issue_id = i.id), 0)
    + COALESCE((SELECT sum(a.fine_weight_delta) FROM public.gold_adjustments a WHERE a.issue_id = i.id), 0)
  FROM public.gold_issues i WHERE i.id = _issue_id
$$;

CREATE OR REPLACE FUNCTION public.next_tx_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'TX-' || nextval('public.gold_tx_seq')::text
$$;

-- ===== Write RPCs (role-checked, atomic, idempotent, audited) =====
CREATE OR REPLACE FUNCTION public.create_gold_issue(
  _karigar_id uuid, _item_category_id uuid, _job_number text,
  _gross_weight numeric, _purity_percent numeric, _issue_date date, _client_request_id uuid)
RETURNS public.gold_issues LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gold_issues; cat public.item_categories;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'issue_clerk') OR public.has_role(auth.uid(), 'finance_head')) THEN
    RAISE EXCEPTION 'Not authorised to create gold issues' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.gold_issues WHERE client_request_id = _client_request_id;
  IF FOUND THEN RETURN r; END IF;
  IF _job_number IS NULL OR length(trim(_job_number)) = 0 THEN RAISE EXCEPTION 'Job number is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.karigars WHERE id = _karigar_id AND is_active) THEN RAISE EXCEPTION 'Karigar is not active'; END IF;
  SELECT * INTO cat FROM public.item_categories WHERE id = _item_category_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item category is not active'; END IF;
  IF _issue_date > current_date THEN RAISE EXCEPTION 'Issue date cannot be in the future'; END IF;

  INSERT INTO public.gold_issues (transaction_number, karigar_id, job_number, item_category_id,
    gross_weight, purity_percent, fine_weight, allowed_wastage_percent, issue_date, client_request_id, created_by)
  VALUES (public.next_tx_number(), _karigar_id, trim(_job_number), _item_category_id,
    round(_gross_weight, 3), round(_purity_percent, 2), 1, cat.allowed_wastage_percent,
    COALESCE(_issue_date, current_date), _client_request_id, auth.uid())
  RETURNING * INTO r;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create', 'gold_issue', r.id,
    jsonb_build_object('transaction_number', r.transaction_number, 'fine_weight', r.fine_weight));
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.create_gold_receipt(
  _issue_id uuid, _receipt_type text, _gross_weight numeric, _purity_percent numeric,
  _huid text, _receipt_date date, _client_request_id uuid)
RETURNS public.gold_receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gold_receipts; iss public.gold_issues; fine numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'issue_clerk') OR public.has_role(auth.uid(), 'finance_head')) THEN
    RAISE EXCEPTION 'Not authorised to create gold receipts' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.gold_receipts WHERE client_request_id = _client_request_id;
  IF FOUND THEN RETURN r; END IF;
  SELECT * INTO iss FROM public.gold_issues WHERE id = _issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF iss.status <> 'open' THEN RAISE EXCEPTION 'Issue % is closed', iss.transaction_number; END IF;
  IF _receipt_date > current_date THEN RAISE EXCEPTION 'Receipt date cannot be in the future'; END IF;
  fine := public.calc_fine_weight(round(_gross_weight, 3), round(_purity_percent, 2));
  IF fine > public.issue_outstanding(_issue_id) THEN
    RAISE EXCEPTION 'Receipt fine weight % g exceeds outstanding % g on %', fine, public.issue_outstanding(_issue_id), iss.transaction_number;
  END IF;

  INSERT INTO public.gold_receipts (transaction_number, issue_id, karigar_id, receipt_type,
    gross_weight, purity_percent, fine_weight, huid, receipt_date, client_request_id, created_by)
  VALUES (public.next_tx_number(), iss.id, iss.karigar_id, _receipt_type,
    round(_gross_weight, 3), round(_purity_percent, 2), 1, NULLIF(upper(trim(_huid)), ''),
    COALESCE(_receipt_date, current_date), _client_request_id, auth.uid())
  RETURNING * INTO r;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create', 'gold_receipt', r.id,
    jsonb_build_object('transaction_number', r.transaction_number, 'issue', iss.transaction_number, 'fine_weight', r.fine_weight));
  RETURN r;
END $$;

-- Closing an issue books the remaining balance as loss and raises an alert if above the agreed limit.
CREATE OR REPLACE FUNCTION public._close_issue(_issue_id uuid, _user uuid)
RETURNS public.gold_issues LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE iss public.gold_issues; actual numeric; expected numeric; excess numeric;
BEGIN
  SELECT * INTO iss FROM public.gold_issues WHERE id = _issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF iss.status <> 'open' THEN RAISE EXCEPTION 'Issue already closed'; END IF;
  actual := public.issue_outstanding(_issue_id);
  expected := round(iss.fine_weight * iss.allowed_wastage_percent / 100, 3);
  excess := actual - expected;
  UPDATE public.gold_issues SET status = 'closed', closed_at = now() WHERE id = _issue_id RETURNING * INTO iss;
  IF excess > 0 THEN
    INSERT INTO public.loss_alerts (karigar_id, issue_id, alert_type, expected_loss, actual_loss, excess_loss, severity, is_demo)
    VALUES (iss.karigar_id, iss.id, 'excess_wastage', expected, actual, excess,
      CASE WHEN excess > expected * 0.5 THEN 'high' WHEN excess > expected * 0.1 THEN 'medium' ELSE 'low' END, iss.is_demo);
  END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user, 'close', 'gold_issue', iss.id,
    jsonb_build_object('transaction_number', iss.transaction_number, 'actual_loss', actual, 'expected_loss', expected));
  RETURN iss;
END $$;
REVOKE ALL ON FUNCTION public._close_issue(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.close_gold_issue(_issue_id uuid)
RETURNS public.gold_issues LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can close issues' USING ERRCODE = '42501';
  END IF;
  RETURN public._close_issue(_issue_id, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.create_gold_adjustment(
  _karigar_id uuid, _issue_id uuid, _fine_weight_delta numeric, _reason text, _client_request_id uuid)
RETURNS public.gold_adjustments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gold_adjustments;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can record adjustments' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.gold_adjustments WHERE client_request_id = _client_request_id;
  IF FOUND THEN RETURN r; END IF;
  INSERT INTO public.gold_adjustments (transaction_number, karigar_id, issue_id, fine_weight_delta, reason, client_request_id, created_by)
  VALUES ('ADJ-' || nextval('public.gold_tx_seq'), _karigar_id, _issue_id, round(_fine_weight_delta, 3), trim(_reason), _client_request_id, auth.uid())
  RETURNING * INTO r;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create', 'gold_adjustment', r.id, jsonb_build_object('delta', r.fine_weight_delta, 'reason', r.reason));
  RETURN r;
END $$;

-- ===== Finance-only read RPCs =====
CREATE OR REPLACE FUNCTION public.get_karigar_balances()
RETURNS TABLE (karigar_id uuid, karigar_code text, full_name text, is_demo boolean, open_jobs bigint,
  fine_issued numeric, fine_returned numeric, fine_adjusted numeric, outstanding numeric, closed_loss_percent numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Finance head access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT k.id, k.karigar_code, k.full_name, k.is_demo,
    (SELECT count(*) FROM gold_issues i WHERE i.karigar_id = k.id AND i.status = 'open'),
    COALESCE((SELECT sum(i.fine_weight) FROM gold_issues i WHERE i.karigar_id = k.id), 0)::numeric,
    COALESCE((SELECT sum(r.fine_weight) FROM gold_receipts r WHERE r.karigar_id = k.id), 0)::numeric,
    COALESCE((SELECT sum(a.fine_weight_delta) FROM gold_adjustments a WHERE a.karigar_id = k.id), 0)::numeric,
    (COALESCE((SELECT sum(i.fine_weight) FROM gold_issues i WHERE i.karigar_id = k.id AND i.status = 'open'), 0)
      - COALESCE((SELECT sum(r.fine_weight) FROM gold_receipts r JOIN gold_issues i ON i.id = r.issue_id WHERE i.karigar_id = k.id AND i.status = 'open'), 0)
      + COALESCE((SELECT sum(a.fine_weight_delta) FROM gold_adjustments a JOIN gold_issues i ON i.id = a.issue_id WHERE i.karigar_id = k.id AND i.status = 'open'), 0))::numeric,
    (SELECT CASE WHEN sum(i.fine_weight) > 0 THEN round(sum(public.issue_outstanding(i.id)) * 100 / sum(i.fine_weight), 2) END
       FROM gold_issues i WHERE i.karigar_id = k.id AND i.status = 'closed')
  FROM karigars k WHERE k.is_active ORDER BY k.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.get_stock_statement(_from date, _to date)
RETURNS TABLE (day date, issued numeric, received_jewellery numeric, received_scrap numeric,
  received_filings numeric, adjustments numeric, net_movement numeric, closing_with_karigars numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Finance head access required' USING ERRCODE = '42501';
  END IF;
  IF _to < _from OR _to - _from > 366 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
  RETURN QUERY
  WITH days AS (SELECT generate_series(_from, _to, interval '1 day')::date AS d),
  agg AS (
    SELECT d.d,
      COALESCE((SELECT sum(fine_weight) FROM gold_issues WHERE issue_date = d.d), 0) AS iss,
      COALESCE((SELECT sum(fine_weight) FROM gold_receipts WHERE receipt_date = d.d AND receipt_type = 'jewellery'), 0) AS rj,
      COALESCE((SELECT sum(fine_weight) FROM gold_receipts WHERE receipt_date = d.d AND receipt_type = 'scrap'), 0) AS rs,
      COALESCE((SELECT sum(fine_weight) FROM gold_receipts WHERE receipt_date = d.d AND receipt_type = 'filings'), 0) AS rf,
      COALESCE((SELECT sum(fine_weight_delta) FROM gold_adjustments WHERE created_at::date = d.d), 0) AS adj
    FROM days d)
  SELECT a.d, a.iss, a.rj, a.rs, a.rf, a.adj, (a.iss - a.rj - a.rs - a.rf + a.adj),
    (COALESCE((SELECT sum(fine_weight) FROM gold_issues WHERE issue_date <= a.d), 0)
     - COALESCE((SELECT sum(fine_weight) FROM gold_receipts WHERE receipt_date <= a.d), 0)
     + COALESCE((SELECT sum(fine_weight_delta) FROM gold_adjustments WHERE created_at::date <= a.d), 0))
  FROM agg a ORDER BY a.d;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_gold_issue, public.create_gold_receipt, public.close_gold_issue,
  public.create_gold_adjustment, public.get_karigar_balances, public.get_stock_statement FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gold_issue, public.create_gold_receipt, public.close_gold_issue,
  public.create_gold_adjustment, public.get_karigar_balances, public.get_stock_statement TO authenticated;

-- ===== Seed data (demo) =====
INSERT INTO public.item_categories (category_name, allowed_wastage_percent) VALUES
  ('Necklace', 3.00), ('Bangles', 2.50), ('Rings', 2.00), ('Earrings', 2.75), ('Chains', 1.50);

INSERT INTO public.karigars (karigar_code, full_name, phone, preferred_language, is_demo) VALUES
  ('KG-001', 'Murugesan S', '+91 98400 11201', 'Tamil', true),
  ('KG-002', 'Rajesh K', '+91 98400 11202', 'Tamil', true),
  ('KG-003', 'Kumaravel P', '+91 98400 11203', 'Tamil', true),
  ('KG-004', 'Senthil M', '+91 98400 11204', 'Tamil', true),
  ('KG-005', 'Prakash R', '+91 98400 11205', 'Telugu', true);

INSERT INTO public.gold_issues (transaction_number, karigar_id, job_number, item_category_id, gross_weight,
  purity_percent, fine_weight, allowed_wastage_percent, issue_date, is_demo)
SELECT 'TX-30411', k.id, 'JOB-2026-0411', c.id, 120.000, 91.60, 1, 3.00, DATE '2026-11-02', true
FROM public.karigars k, public.item_categories c WHERE k.karigar_code = 'KG-001' AND c.category_name = 'Necklace';

INSERT INTO public.gold_receipts (transaction_number, issue_id, karigar_id, receipt_type, gross_weight, purity_percent, fine_weight, receipt_date, is_demo)
SELECT 'TX-30437', i.id, i.karigar_id, 'jewellery', 112.450, 91.60, 1, DATE '2026-11-06', true FROM public.gold_issues i WHERE i.transaction_number = 'TX-30411';
INSERT INTO public.gold_receipts (transaction_number, issue_id, karigar_id, receipt_type, gross_weight, purity_percent, fine_weight, receipt_date, is_demo)
SELECT 'TX-30438', i.id, i.karigar_id, 'scrap', 3.300, 91.60, 1, DATE '2026-11-06', true FROM public.gold_issues i WHERE i.transaction_number = 'TX-30411';

INSERT INTO public.audit_logs (action, entity_type, details) VALUES ('seed', 'demo_data', '{"note":"Demo karigars and TX-30411/30437/30438"}');
