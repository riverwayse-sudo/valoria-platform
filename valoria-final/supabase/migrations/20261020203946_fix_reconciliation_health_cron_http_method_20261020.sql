-- The monitor is a GET endpoint; keep the Supabase schedule aligned with it.
DO $outer$
DECLARE existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'valoria-reconciliation-health'
  LIMIT 1;
  IF existing_job_id IS NULL THEN
    RAISE EXCEPTION 'valoria-reconciliation-health cron job is missing';
  END IF;
  PERFORM cron.alter_job(
    existing_job_id,
    schedule := '0 4 * * *',
    command := $job$
      SELECT net.http_get(
        url := 'https://assessment.valoriainstitute.com/api/reconciliation-health',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-valoria-function-key', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'valoria_privileged_function_invoke_key'
          )
        ),
        timeout_milliseconds := 20000
      ) AS request_id;
    $job$
  );
END
$outer$;
