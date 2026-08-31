-- VALU v4 marketplace lifecycle contract.
-- This migration adds executable invariants without mutating real professional records.

create or replace function private.assert_marketplace_listing_invariants(p_professional_id uuid)
returns void language plpgsql security definer set search_path=public,private as $$
declare p record;
begin
 select listing_status,eligible_for_listing,availability_status,visibility,valu_index into p from public.professional_profiles where id=p_professional_id;
 if not found then raise exception 'professional not found: %',p_professional_id; end if;
 if p.eligible_for_listing and coalesce(p.valu_index,0)<35 then raise exception 'eligibility invariant violated: score below 35'; end if;
 if p.listing_status='listed' and not p.eligible_for_listing then raise exception 'listing invariant violated: listed profile is not eligible'; end if;
 if p.listing_status in ('suspended','revoked') and p.listing_status='listed' then raise exception 'governance invariant violated'; end if;
end; $$;
revoke all on function private.assert_marketplace_listing_invariants(uuid) from public,anon,authenticated;
grant execute on function private.assert_marketplace_listing_invariants(uuid) to service_role;
