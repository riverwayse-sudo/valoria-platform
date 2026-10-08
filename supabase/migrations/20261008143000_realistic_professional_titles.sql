-- Keep internal QA fixtures realistic in the public professional experience.
-- is_test remains internal metadata and is intentionally not changed.
update public.professional_profiles p
set
  designation = v.designation,
  current_job_title = v.job_title,
  headline = v.headline,
  updated_at = now()
from (values
  ('ATB-C-AAA-00176', 'Project Manager', 'Project Manager', 'Project Manager focused on delivery, coordination and measurable outcomes.'),
  ('ATB-C-JAA-00386', 'Business Development Manager', 'Business Development Manager', 'Business Development Manager focused on growth, partnerships and commercial opportunities.'),
  ('ATB-C-SMM-00178', 'Product Marketing Manager', 'Product Marketing Manager', 'Product Marketing Manager focused on positioning, market insight and customer value.')
) as v(atb_id, designation, job_title, headline)
where p.atb_id = v.atb_id;

-- Rebuild each affected public roster record from the canonical professional profile.
do $$
declare
  r record;
begin
  for r in
    select id from public.professional_profiles
    where atb_id in ('ATB-C-AAA-00176','ATB-C-JAA-00386','ATB-C-SMM-00178')
  loop
    perform public.refresh_marketplace_public_roster(r.id);
  end loop;
end $$;
