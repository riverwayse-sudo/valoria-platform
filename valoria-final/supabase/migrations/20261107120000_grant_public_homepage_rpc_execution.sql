-- Public homepage RPCs expose only the curated public roster projection.
-- Their underlying table read remains protected by marketplace_public_read RLS.
GRANT EXECUTE ON FUNCTION public.get_homepage_professional_previews_v2() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_homepage_professional_count() TO anon, authenticated;
