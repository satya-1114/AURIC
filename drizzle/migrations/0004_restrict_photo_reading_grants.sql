REVOKE ALL ON public.photo_readings FROM anon,authenticated;
GRANT SELECT ON public.photo_readings TO authenticated;
GRANT ALL ON public.photo_readings TO service_role;
REVOKE ALL ON public.photo_ai_access FROM anon,authenticated;
GRANT ALL ON public.photo_ai_access TO service_role;