-- Case-insensitive unique karigar codes
CREATE UNIQUE INDEX IF NOT EXISTS karigars_code_ci_unique ON public.karigars (upper(karigar_code));
ALTER TABLE public.karigars ADD CONSTRAINT karigars_code_format CHECK (karigar_code ~ '^[A-Z0-9-]{2,20}$');
ALTER TABLE public.karigars ADD CONSTRAINT karigars_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9 +()-]{6,20}$');

-- Configurable loss-monitoring thresholds (single row)
CREATE TABLE public.loss_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  recent_window integer NOT NULL DEFAULT 3 CHECK (recent_window BETWEEN 1 AND 20),
  min_history_jobs integer NOT NULL DEFAULT 3 CHECK (min_history_jobs BETWEEN 1 AND 50),
  trend_ratio numeric(5,2) NOT NULL DEFAULT 1.25 CHECK (trend_ratio >= 1),
  min_excess_points numeric(5,2) NOT NULL DEFAULT 0.25 CHECK (min_excess_points >= 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loss_settings TO authenticated;
GRANT ALL ON public.loss_settings TO service_role;
ALTER TABLE public.loss_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read loss settings" ON public.loss_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance_head'));
INSERT INTO public.loss_settings (id) VALUES (true);

-- Review workflow fields on alerts (additive)
ALTER TABLE public.loss_alerts ADD COLUMN review_note text;
ALTER TABLE public.loss_alerts ADD COLUMN reviewed_by uuid;
ALTER TABLE public.loss_alerts ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.loss_alerts ADD COLUMN recent_loss_percent numeric(6,2);
ALTER TABLE public.loss_alerts ADD COLUMN historical_loss_percent numeric(6,2);
-- Dedupe: one excess alert per issue; one open trend alert per karigar
CREATE UNIQUE INDEX loss_alerts_issue_type_unique ON public.loss_alerts (issue_id, alert_type) WHERE issue_id IS NOT NULL;
CREATE UNIQUE INDEX loss_alerts_open_trend_unique ON public.loss_alerts (karigar_id) WHERE alert_type = 'rising_trend' AND status = 'open';

-- ===== Karigar master RPCs (finance head) =====
CREATE OR REPLACE FUNCTION public.save_karigar(_id uuid, _karigar_code text, _full_name text, _phone text, _preferred_language text)
RETURNS public.karigars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.karigars; old public.karigars; code text := upper(trim(_karigar_code));
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can manage karigars' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(_full_name, ''))) = 0 OR length(_full_name) > 100 THEN RAISE EXCEPTION 'Full name is required (max 100 characters)'; END IF;
  IF _id IS NULL THEN
    IF EXISTS (SELECT 1 FROM karigars WHERE upper(karigar_code) = code) THEN RAISE EXCEPTION 'Karigar code % already exists', code; END IF;
    INSERT INTO karigars (karigar_code, full_name, phone, preferred_language)
    VALUES (code, trim(_full_name), NULLIF(trim(_phone), ''), NULLIF(trim(_preferred_language), ''))
    RETURNING * INTO r;
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'create', 'karigar', r.id, to_jsonb(r));
  ELSE
    SELECT * INTO old FROM karigars WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Karigar not found'; END IF;
    -- Code is immutable once created: it identifies historical transactions.
    UPDATE karigars SET full_name = trim(_full_name), phone = NULLIF(trim(_phone), ''),
      preferred_language = NULLIF(trim(_preferred_language), '')
    WHERE id = _id RETURNING * INTO r;
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'update', 'karigar', r.id, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(r)));
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.set_karigar_active(_id uuid, _active boolean)
RETURNS public.karigars LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.karigars;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can manage karigars' USING ERRCODE = '42501';
  END IF;
  UPDATE karigars SET is_active = _active WHERE id = _id RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Karigar not found'; END IF;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN _active THEN 'activate' ELSE 'deactivate' END, 'karigar', r.id, NULL);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.delete_karigar(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.karigars;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can manage karigars' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old FROM karigars WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Karigar not found'; END IF;
  IF EXISTS (SELECT 1 FROM gold_issues WHERE karigar_id = _id) OR EXISTS (SELECT 1 FROM gold_receipts WHERE karigar_id = _id)
     OR EXISTS (SELECT 1 FROM gold_adjustments WHERE karigar_id = _id) OR EXISTS (SELECT 1 FROM loss_alerts WHERE karigar_id = _id) THEN
    RAISE EXCEPTION 'Karigar has transaction history and cannot be deleted; deactivate instead';
  END IF;
  DELETE FROM karigars WHERE id = _id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'delete', 'karigar', _id, to_jsonb(old));
END $$;

-- Outstanding per karigar, readable by any staff (clerks see balances on the karigar list only)
CREATE OR REPLACE FUNCTION public.get_karigar_outstanding()
RETURNS TABLE (karigar_id uuid, outstanding numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT k.id, COALESCE((SELECT sum(public.issue_outstanding(i.id)) FROM gold_issues i WHERE i.karigar_id = k.id AND i.status = 'open'), 0)::numeric
  FROM karigars k;
END $$;

-- ===== Category RPCs (finance head) =====
-- Issues snapshot allowed_wastage_percent at creation, so edits never alter history.
CREATE OR REPLACE FUNCTION public.save_item_category(_id uuid, _category_name text, _allowed_wastage_percent numeric, _is_active boolean)
RETURNS public.item_categories LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.item_categories; old public.item_categories;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN
    RAISE EXCEPTION 'Only the finance head can configure categories' USING ERRCODE = '42501';
  END IF;
  IF _allowed_wastage_percent IS NULL OR _allowed_wastage_percent < 0 OR _allowed_wastage_percent > 100
     OR _allowed_wastage_percent <> round(_allowed_wastage_percent, 2) THEN
    RAISE EXCEPTION 'Wastage must be between 0 and 100 with at most 2 decimals';
  END IF;
  IF length(trim(coalesce(_category_name, ''))) = 0 THEN RAISE EXCEPTION 'Category name is required'; END IF;
  IF _id IS NULL THEN
    INSERT INTO item_categories (category_name, allowed_wastage_percent, is_active)
    VALUES (trim(_category_name), _allowed_wastage_percent, coalesce(_is_active, true)) RETURNING * INTO r;
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (auth.uid(), 'create', 'item_category', r.id, to_jsonb(r));
  ELSE
    SELECT * INTO old FROM item_categories WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Category not found'; END IF;
    UPDATE item_categories SET category_name = trim(_category_name), allowed_wastage_percent = _allowed_wastage_percent,
      is_active = coalesce(_is_active, is_active) WHERE id = _id RETURNING * INTO r;
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'update', 'item_category', r.id, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(r)));
  END IF;
  RETURN r;
END $$;

-- ===== Loss monitoring =====
CREATE OR REPLACE FUNCTION public.save_loss_settings(_recent_window integer, _min_history_jobs integer, _trend_ratio numeric, _min_excess_points numeric)
RETURNS public.loss_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.loss_settings; old public.loss_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN RAISE EXCEPTION 'Finance head access required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO old FROM loss_settings WHERE id;
  UPDATE loss_settings SET recent_window = _recent_window, min_history_jobs = _min_history_jobs, trend_ratio = _trend_ratio,
    min_excess_points = _min_excess_points, updated_by = auth.uid(), updated_at = now() WHERE id RETURNING * INTO r;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'update', 'loss_settings', NULL, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(r)));
  RETURN r;
END $$;

-- Per-karigar closed-job wastage: recent window vs earlier history.
CREATE OR REPLACE FUNCTION public._wastage_trend(_karigar_id uuid)
RETURNS TABLE (closed_jobs bigint, recent_percent numeric, historical_percent numeric, recent_excess numeric, is_rising boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.loss_settings;
BEGIN
  SELECT * INTO s FROM loss_settings WHERE id;
  RETURN QUERY
  WITH jobs AS (
    SELECT i.fine_weight, public.issue_outstanding(i.id) AS loss,
      round(i.fine_weight * i.allowed_wastage_percent / 100, 3) AS allowed,
      row_number() OVER (ORDER BY i.closed_at DESC, i.id) AS rn
    FROM gold_issues i WHERE i.karigar_id = _karigar_id AND i.status = 'closed'),
  agg AS (
    SELECT count(*) AS n,
      round(sum(loss) FILTER (WHERE rn <= s.recent_window) * 100 / NULLIF(sum(fine_weight) FILTER (WHERE rn <= s.recent_window), 0), 2) AS rp,
      round(sum(loss) FILTER (WHERE rn > s.recent_window) * 100 / NULLIF(sum(fine_weight) FILTER (WHERE rn > s.recent_window), 0), 2) AS hp,
      COALESCE(sum(GREATEST(loss - allowed, 0)) FILTER (WHERE rn <= s.recent_window), 0) AS rx,
      count(*) FILTER (WHERE rn > s.recent_window) AS hn
    FROM jobs)
  SELECT a.n, a.rp, a.hp, a.rx,
    (a.hn >= s.min_history_jobs AND a.rp IS NOT NULL AND a.hp IS NOT NULL
      AND a.rp >= a.hp * s.trend_ratio AND a.rp - a.hp >= s.min_excess_points)
  FROM agg a;
END $$;
REVOKE ALL ON FUNCTION public._wastage_trend(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_wastage_trends()
RETURNS TABLE (karigar_id uuid, full_name text, karigar_code text, closed_jobs bigint, recent_percent numeric,
  historical_percent numeric, recent_excess numeric, is_rising boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN RAISE EXCEPTION 'Finance head access required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT k.id, k.full_name, k.karigar_code, t.closed_jobs, t.recent_percent, t.historical_percent, t.recent_excess, t.is_rising
  FROM karigars k CROSS JOIN LATERAL public._wastage_trend(k.id) t ORDER BY t.is_rising DESC, k.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.review_loss_alert(_id uuid, _status text, _note text)
RETURNS public.loss_alerts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.loss_alerts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'finance_head') THEN RAISE EXCEPTION 'Finance head access required' USING ERRCODE = '42501'; END IF;
  IF _status NOT IN ('acknowledged', 'resolved') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE loss_alerts SET status = _status, review_note = NULLIF(trim(_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _id RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alert not found'; END IF;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'review', 'loss_alert', r.id, jsonb_build_object('status', _status, 'note', r.review_note));
  RETURN r;
END $$;

-- Closing an issue: excess-wastage alert (once per issue) + rising-trend review item (one open per karigar).
CREATE OR REPLACE FUNCTION public._close_issue(_issue_id uuid, _user uuid)
RETURNS public.gold_issues LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE iss public.gold_issues; actual numeric; expected numeric; excess numeric; t record;
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
      CASE WHEN excess > expected * 0.5 THEN 'high' WHEN excess > expected * 0.1 THEN 'medium' ELSE 'low' END, iss.is_demo)
    ON CONFLICT DO NOTHING;
  END IF;
  SELECT * INTO t FROM public._wastage_trend(iss.karigar_id);
  IF t.is_rising THEN
    INSERT INTO public.loss_alerts (karigar_id, alert_type, expected_loss, actual_loss, excess_loss, severity,
      recent_loss_percent, historical_loss_percent, is_demo)
    VALUES (iss.karigar_id, 'rising_trend', 0, t.recent_excess, t.recent_excess, 'medium', t.recent_percent, t.historical_percent, iss.is_demo)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_user, 'close', 'gold_issue', iss.id,
    jsonb_build_object('transaction_number', iss.transaction_number, 'actual_loss', actual, 'expected_loss', expected));
  RETURN iss;
END $$;
REVOKE ALL ON FUNCTION public._close_issue(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.save_karigar, public.set_karigar_active, public.delete_karigar, public.get_karigar_outstanding,
  public.save_item_category, public.save_loss_settings, public.get_wastage_trends, public.review_loss_alert FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_karigar, public.set_karigar_active, public.delete_karigar, public.get_karigar_outstanding,
  public.save_item_category, public.save_loss_settings, public.get_wastage_trends, public.review_loss_alert TO authenticated;
-- Internal helpers should never be callable directly
REVOKE EXECUTE ON FUNCTION public.issue_outstanding(uuid), public.next_tx_number() FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.loss_settings FROM authenticated, anon;