-- Valoria introduction authorization matrix.
-- Buyer-side capability -> professional capability is configuration, not scattered API logic.

create table if not exists public.introduction_capability_rules (
  id uuid primary key default gen_random_uuid(),
  organization_capability text not null check (lower(organization_capability) in ('employer','event_organizer')),
  professional_capability text not null check (lower(professional_capability) in ('talent','speaker','facilitator')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_capability, professional_capability)
);

insert into public.introduction_capability_rules (organization_capability, professional_capability, enabled)
values
  ('employer','talent',true),
  ('employer','speaker',true),
  ('employer','facilitator',true),
  ('event_organizer','talent',false),
  ('event_organizer','speaker',true),
  ('event_organizer','facilitator',true)
on conflict (organization_capability, professional_capability) do nothing;

alter table public.introduction_capability_rules enable row level security;
revoke all on public.introduction_capability_rules from anon, authenticated;
grant select on public.introduction_capability_rules to authenticated;

-- Public authenticated users may read policy configuration, but cannot modify it.
drop policy if exists introduction_rules_read on public.introduction_capability_rules;
create policy introduction_rules_read
on public.introduction_capability_rules for select to authenticated
using (true);

comment on table public.introduction_capability_rules is
'Valoria-controlled buyer-to-professional introduction policy. Admin changes must use a trusted administrative path and audit log.';

-- Safe authorization helper for server-side introduction creation.
create or replace function public.can_request_introduction(
  p_organization_id uuid,
  p_professional_id uuid,
  p_professional_capability text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_capabilities oc
    join public.introduction_capability_rules r
      on lower(r.organization_capability) = lower(oc.capability)
     and lower(r.professional_capability) = lower(p_professional_capability)
    join public.professional_capabilities pc
      on pc.professional_id = p_professional_id
     and lower(pc.capability) = lower(p_professional_capability)
     and pc.is_active = true
    join public.professional_profiles p
      on p.id = p_professional_id
     and p.listing_status = 'LISTED'
     and p.availability_status in ('AVAILABLE','LIMITED')
     and p.profile_visibility = 'PUBLIC'
     and coalesce(p.eligible_for_listing,false) = true
    where oc.organization_id = p_organization_id
      and oc.is_active = true
      and r.enabled = true
  );
$$;

revoke execute on function public.can_request_introduction(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.can_request_introduction(uuid,uuid,text) to service_role;
