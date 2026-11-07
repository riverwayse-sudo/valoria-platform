-- The public roster is a deliberately curated projection. Grant read access to its
-- public roles, while row visibility remains enforced by marketplace_public_read RLS.
GRANT SELECT ON TABLE public.marketplace_public_roster TO anon, authenticated;
