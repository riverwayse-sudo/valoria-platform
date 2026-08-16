-- Valoria private professional-document governance foundation.
-- CVs and evidence remain private; marketplace projection never exposes storage paths.

alter table public.professional_documents
  add column if not exists visibility text not null default 'PRIVATE'
    check (visibility in ('PRIVATE','APPROVED_SHARE'));

alter table public.professional_documents
  add column if not exists verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','PENDING','VERIFIED','REJECTED'));

alter table public.professional_documents
  add column if not exists verified_at timestamptz;

alter table public.professional_documents
  add column if not exists verified_by uuid references auth.users(id);

alter table public.professional_documents enable row level security;
revoke all on public.professional_documents from anon;

-- Professionals may read their own documents and insert/update only their own records.
drop policy if exists professional_documents_owner_select on public.professional_documents;
create policy professional_documents_owner_select
on public.professional_documents for select to authenticated
using (professional_id = auth.uid());

drop policy if exists professional_documents_owner_insert on public.professional_documents;
create policy professional_documents_owner_insert
on public.professional_documents for insert to authenticated
with check (professional_id = auth.uid() and visibility = 'PRIVATE' and verification_status = 'UNVERIFIED');

drop policy if exists professional_documents_owner_update on public.professional_documents;
create policy professional_documents_owner_update
on public.professional_documents for update to authenticated
using (professional_id = auth.uid())
with check (professional_id = auth.uid());

-- No delete policy: historical evidence should not disappear silently.
revoke delete on public.professional_documents from authenticated;

-- Service-side governance operation for verifying/rejecting a document.
create or replace function public.admin_set_document_verification(
  p_document_id uuid,
  p_status text,
  p_share boolean default false
) returns public.professional_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.professional_documents;
begin
  if not public.require_platform_admin() then
    raise exception 'Administrator authorization required';
  end if;

  if upper(p_status) not in ('PENDING','VERIFIED','REJECTED','UNVERIFIED') then
    raise exception 'Invalid document verification status';
  end if;

  update public.professional_documents
  set verification_status = upper(p_status),
      visibility = case when upper(p_status) = 'VERIFIED' and p_share then 'APPROVED_SHARE' else 'PRIVATE' end,
      verified_at = case when upper(p_status) = 'VERIFIED' then now() else null end,
      verified_by = case when upper(p_status) = 'VERIFIED' then auth.uid() else null end
  where id = p_document_id
  returning * into result;

  if result.id is null then raise exception 'Document not found'; end if;
  return result;
end;
$$;

revoke execute on function public.admin_set_document_verification(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_document_verification(uuid,text,boolean) to service_role;

comment on table public.professional_documents is
'Private professional evidence. Marketplace discovery never exposes document storage paths; sharing requires explicit governance approval.';
