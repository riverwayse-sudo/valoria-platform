-- Valoria rate-limit protocol
-- Shared, atomic limiter for server-side API routes.
-- The service role calls the RPC; browser roles are denied direct access.

create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from anon, authenticated;

drop policy if exists "api_rate_limits_no_client_access" on public.api_rate_limits;

create or replace function public.consume_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
  v_elapsed integer;
  v_remaining integer;
begin
  if p_rate_key is null or length(p_rate_key) < 3 or length(p_rate_key) > 300 then
    raise exception 'invalid rate key';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit configuration';
  end if;

  insert into public.api_rate_limits(rate_key, window_started_at, request_count, updated_at)
  values (p_rate_key, v_now, 1, v_now)
  on conflict (rate_key) do update
    set window_started_at = case
          when extract(epoch from (v_now - api_rate_limits.window_started_at)) >= p_window_seconds
            then v_now
          else api_rate_limits.window_started_at
        end,
        request_count = case
          when extract(epoch from (v_now - api_rate_limits.window_started_at)) >= p_window_seconds
            then 1
          else api_rate_limits.request_count + 1
        end,
        updated_at = v_now
  returning * into v_row;

  v_elapsed := greatest(0, floor(extract(epoch from (v_now - v_row.window_started_at)))::integer);
  v_remaining := greatest(0, p_limit - v_row.request_count);

  return query
  select
    v_row.request_count <= p_limit,
    v_remaining,
    case when v_row.request_count > p_limit
      then greatest(1, p_window_seconds - v_elapsed)
      else 0
    end;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
