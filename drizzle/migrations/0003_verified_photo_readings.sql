CREATE TABLE public.photo_readings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, client_request_id uuid NOT NULL,
 operation text NOT NULL CHECK(operation IN ('issue','receipt')), created_at timestamptz NOT NULL DEFAULT now(),
 extraction jsonb, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','rejected')),
 verified_weight numeric(12,3), verified_purity numeric(5,2), verified_at timestamptz, verification_reason text,
 confidence_threshold numeric NOT NULL DEFAULT 0.90 CHECK(confidence_threshold BETWEEN 0 AND 1),
 error_message text, consumed_entity_id uuid,
 CHECK(verified_weight IS NULL OR verified_weight > 0), CHECK(verified_purity IS NULL OR verified_purity > 0 AND verified_purity <= 100)
);
GRANT SELECT ON public.photo_readings TO authenticated;
GRANT ALL ON public.photo_readings TO service_role;
ALTER TABLE public.photo_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff own photo readings" ON public.photo_readings FOR SELECT TO authenticated USING(user_id=auth.uid() AND (public.has_role(auth.uid(),'issue_clerk') OR public.has_role(auth.uid(),'finance_head')));
CREATE INDEX photo_readings_request ON public.photo_readings(client_request_id);
CREATE TABLE public.photo_ai_access (id text PRIMARY KEY, blocked_message text, blocked_status integer, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.photo_ai_access TO service_role;
ALTER TABLE public.photo_ai_access ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.verify_photo_reading(_id uuid, _reject boolean, _weight numeric DEFAULT NULL, _purity numeric DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS public.photo_readings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.photo_readings; manual_required boolean;
BEGIN
 IF NOT (public.has_role(auth.uid(),'issue_clerk') OR public.has_role(auth.uid(),'finance_head')) THEN RAISE EXCEPTION 'Not authorised' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.photo_readings WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reading not found' USING ERRCODE='42501'; END IF;
 IF r.consumed_entity_id IS NOT NULL THEN RAISE EXCEPTION 'Reading already used'; END IF;
 IF NOT _reject THEN
  IF _weight IS NULL AND _purity IS NULL THEN RAISE EXCEPTION 'Enter a weight or purity to verify'; END IF;
  IF _weight IS NOT NULL AND (_weight<=0 OR _weight<>round(_weight,3)) THEN RAISE EXCEPTION 'Weight must be positive with at most 3 decimals'; END IF;
  IF _purity IS NOT NULL AND (_purity<=0 OR _purity>100 OR _purity<>round(_purity,2)) THEN RAISE EXCEPTION 'Purity must be within 0–100 with at most 2 decimals'; END IF;
  manual_required := r.extraction IS NULL OR r.error_message IS NOT NULL
    OR COALESCE((r.extraction->>'confidence')::numeric,0)<r.confidence_threshold
    OR COALESCE(jsonb_array_length(r.extraction->'warnings'),0)>0
    OR _weight IS DISTINCT FROM NULLIF(r.extraction->>'gross_weight','')::numeric
    OR _purity IS DISTINCT FROM NULLIF(r.extraction->>'purity_percent','')::numeric;
  IF manual_required AND length(trim(COALESCE(_reason,'')))<5 THEN RAISE EXCEPTION 'Manual verification requires a reason'; END IF;
 END IF;
 UPDATE public.photo_readings SET status=CASE WHEN _reject THEN 'rejected' ELSE 'confirmed' END,
 verified_weight=CASE WHEN _reject THEN NULL ELSE _weight END, verified_purity=CASE WHEN _reject THEN NULL ELSE _purity END,
 verified_at=now(), verification_reason=NULLIF(trim(_reason),'') WHERE id=_id RETURNING * INTO r;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,details) VALUES(auth.uid(),r.status,'photo_reading',r.id,jsonb_build_object('reason',r.verification_reason,'weight',r.verified_weight,'purity',r.verified_purity));
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.verify_photo_reading(uuid,boolean,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.verify_photo_reading(uuid,boolean,numeric,numeric,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_photo_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.photo_readings; op text;
BEGIN
 op:=CASE WHEN TG_TABLE_NAME='gold_issues' THEN 'issue' ELSE 'receipt' END;
 FOR r IN SELECT * FROM public.photo_readings WHERE client_request_id=NEW.client_request_id FOR UPDATE LOOP
  IF r.operation<>op OR r.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Photo reading belongs to another transaction or user' USING ERRCODE='42501'; END IF;
  IF r.status='rejected' THEN CONTINUE; END IF;
  IF r.status<>'confirmed' THEN RAISE EXCEPTION 'Confirm or reject the photo reading before recording'; END IF;
  IF r.consumed_entity_id IS NOT NULL AND r.consumed_entity_id<>NEW.id THEN RAISE EXCEPTION 'Photo reading already used'; END IF;
  IF r.verified_weight IS NOT NULL AND r.verified_weight<>NEW.gross_weight THEN RAISE EXCEPTION 'Photo weight % g differs from entered % g. Resolve the mismatch.',r.verified_weight,NEW.gross_weight; END IF;
  IF r.verified_purity IS NOT NULL AND r.verified_purity<>NEW.purity_percent THEN RAISE EXCEPTION 'Photo purity % differs from entered %. Resolve the mismatch.',r.verified_purity,NEW.purity_percent; END IF;
  UPDATE public.photo_readings SET consumed_entity_id=NEW.id WHERE id=r.id;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_photo_transaction() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gold_issue_photo_guard BEFORE INSERT ON public.gold_issues FOR EACH ROW EXECUTE FUNCTION public.guard_photo_transaction();
CREATE TRIGGER gold_receipt_photo_guard BEFORE INSERT ON public.gold_receipts FOR EACH ROW EXECUTE FUNCTION public.guard_photo_transaction();