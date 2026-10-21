-- Schedule the reconciliation monitor from Supabase so snapshots do not depend
-- on Vercel Cron availability. The credential is read from Vault at invocation
-- time and is never embedded in this migration or exposed to clients.
DO $outer$
DECLARE existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'valoria-reconciliation-health'
  LIMIT 1;

  IF existing_job_id IS NULL THEN
    PERFORM cron.schedule(
      'valoria-reconciliation-health',
      '0 4 * * *',
      $job$
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
  ELSE
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
  END IF;
END
$outer$;
