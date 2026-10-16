CREATE OR REPLACE FUNCTION public.record_valu_reconciliation_health_snapshot(
  p_health jsonb,
  p_alert_keys text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  snapshot_id bigint;
  recorded timestamptz;
  previous_keys text[] := ARRAY[]::text[];
  current_keys text[] := coalesce(p_alert_keys, ARRAY[]::text[]);
  previous_found boolean := false;
  previous_notification_sent boolean := false;
  changed boolean;
  initial_sent boolean;
BEGIN
  IF p_health IS NULL OR jsonb_typeof(p_health) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A health report object is required.' USING ERRCODE = '22023';
  END IF;

  SELECT alert_keys, notification_sent
    INTO previous_keys, previous_notification_sent
    FROM private.valu_reconciliation_health_snapshots
   ORDER BY id DESC
   LIMIT 1;
  previous_found := FOUND;

  changed := CASE
    WHEN NOT previous_found THEN cardinality(current_keys) > 0
    ELSE previous_keys IS DISTINCT FROM current_keys
      OR previous_notification_sent IS DISTINCT FROM true
  END;
  initial_sent := NOT changed;

  INSERT INTO private.valu_reconciliation_health_snapshots (generated_at, health, alert_keys, notification_sent)
  VALUES (
    coalesce((p_health ->> 'generated_at')::timestamptz, now()),
    p_health,
    current_keys,
    initial_sent
  )
  RETURNING id, recorded_at INTO snapshot_id, recorded;

  RETURN jsonb_build_object(
    'id', snapshot_id,
    'recorded_at', recorded,
    'alert_count', cardinality(current_keys),
    'previous_alert_count', cardinality(coalesce(previous_keys, ARRAY[]::text[])),
    'alert_changed', changed,
    'notification_sent', initial_sent
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_valu_reconciliation_health_snapshot(jsonb, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_valu_reconciliation_health_snapshot(jsonb, text[]) TO service_role;
