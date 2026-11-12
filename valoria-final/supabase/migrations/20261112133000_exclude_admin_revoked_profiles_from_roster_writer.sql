-- Keep the internal roster projection clean when an administrator revokes a listing.
-- The public RPC independently rechecks this state; this patch also prevents stale
-- revoked rows from being reinserted by the roster writer.

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);

  v_old := $old$  select (p.revoked_at is not null) or exists (
    select 1
      from public.professional_listing_events e
     where e.professional_id = p_professional_id
       and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
       and e.created_at = (
         select max(e2.created_at)
           from public.professional_listing_events e2
          where e2.professional_id = p_professional_id
       )
  ) into is_revoked;$old$;

  v_new := $new$  select (p.revoked_at is not null) or exists (
    select 1
      from public.professional_listing_events e
     where e.professional_id = p_professional_id
       and e.event_type in ('ADMIN_REVOKED','ADMIN_SUSPENDED')
       and e.created_at = (
         select max(e2.created_at)
           from public.professional_listing_events e2
          where e2.professional_id = p_professional_id
       )
  ) or coalesce((
    select controls.admin_revoked
    from public.professional_listing_controls controls
    where controls.professional_id = p_professional_id
  ), false) into is_revoked;$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer revocation guard changed; refusing an unsafe patch';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;

DO $assert$
BEGIN
  IF position(
    'controls.admin_revoked' IN pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer does not enforce administrator revocation';
  END IF;
END;
$assert$;
