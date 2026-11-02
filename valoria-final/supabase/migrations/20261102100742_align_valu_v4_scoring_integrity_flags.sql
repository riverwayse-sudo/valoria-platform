create or replace function public.compute_valu_assessments_scores()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.cluster_scores is not null then
    new.p_score := coalesce((new.cluster_scores ->> 'P')::smallint, 0);
    new.r_score := coalesce((new.cluster_scores ->> 'R')::smallint, 0);
    new.i_score := coalesce((new.cluster_scores ->> 'I')::smallint, 0);
    new.m_score := coalesce((new.cluster_scores ->> 'M')::smallint, 0);
    new.e_score := coalesce((new.cluster_scores ->> 'E')::smallint, 0);

    -- Canonical VALU v4 weighted index. Integrity flags remain review signals;
    -- they do not silently reduce the published score.
    new.total_score := round(greatest(0, least(100,
      new.p_score * 0.20
      + new.r_score * 0.25
      + new.i_score * 0.25
      + new.m_score * 0.20
      + new.e_score * 0.10
    )))::smallint;
  end if;

  return new;
end;
$$;
