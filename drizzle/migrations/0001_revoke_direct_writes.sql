REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.karigars, public.item_categories, public.gold_issues, public.gold_receipts,
  public.gold_adjustments, public.loss_alerts, public.audit_logs, public.user_roles FROM authenticated, anon;
REVOKE INSERT, DELETE, TRUNCATE ON public.profiles FROM authenticated, anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;