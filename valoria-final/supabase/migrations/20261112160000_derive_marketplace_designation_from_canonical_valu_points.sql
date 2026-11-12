-- Historical VALU v4 designation strings are not authoritative.
-- Recompute the marketplace projection label from the canonical points bands.
-- Do not rewrite any historical assessment or profile records.

DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);

  v_old := '    select v.total_score, v.cluster_scores, v.designation';
  v_new := '    select v.total_score, v.cluster_scores';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer assessment projection changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '      into canonical_valu_index, canonical_cluster_scores, canonical_designation';
  v_new := '      into canonical_valu_index, canonical_cluster_scores';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer assessment target list changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '    canonical_designation := coalesce(canonical_designation, p.designation);';
  v_new := $canonical$
    canonical_designation := case
      when canonical_valu_index between 90 and 100 then 'Elite'
      when canonical_valu_index between 75 and 89 then 'Distinguished'
      when canonical_valu_index between 55 and 74 then 'Proficient'
      when canonical_valu_index between 35 and 54 then 'Standard'
      else null
    end;$canonical$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace writer legacy designation fallback changed; refusing an unsafe patch';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;

DO $assert$
DECLARE
  v_definition text := pg_get_functiondef('public.refresh_marketplace_public_roster(uuid)'::regprocedure);
BEGIN
  IF position('v.designation' IN v_definition) > 0
     OR position('p.designation' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Marketplace roster writer still trusts a stored designation label';
  END IF;

  IF position('when canonical_valu_index between 90 and 100 then ''Elite''' IN v_definition) = 0
     OR position('when canonical_valu_index between 75 and 89 then ''Distinguished''' IN v_definition) = 0
     OR position('when canonical_valu_index between 55 and 74 then ''Proficient''' IN v_definition) = 0
     OR position('when canonical_valu_index between 35 and 54 then ''Standard''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Marketplace roster writer does not implement the canonical VALU v4 designation bands';
  END IF;
END;
$assert$;
