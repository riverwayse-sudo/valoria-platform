-- Rotate the scheduled Edge Function invocations away from the public
-- publishable key as their only handler authorization. The gateway still uses
-- the publishable key for JWT verification; the private Vault credential is
-- validated by the service-role-only RPC inside each handler.
SELECT cron.alter_job(1, command := $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url')
      || '/functions/v1/sync-leads-to-brevo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'x-valoria-function-key', (select decrypted_secret from vault.decrypted_secrets where name='valoria_privileged_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
$cmd$);

SELECT cron.alter_job(2, command := $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url')
      || '/functions/v1/process-meta-leads',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'x-valoria-function-key', (select decrypted_secret from vault.decrypted_secrets where name='valoria_privileged_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
$cmd$);

SELECT cron.alter_job(3, command := $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url')
      || '/functions/v1/send-lead-meeting-link',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'x-valoria-function-key', (select decrypted_secret from vault.decrypted_secrets where name='valoria_privileged_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
$cmd$);

SELECT cron.alter_job(4, command := $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='valoria_project_url')
      || '/functions/v1/send-assessment-completion-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='valoria_function_invoke_key'),
      'x-valoria-function-key', (select decrypted_secret from vault.decrypted_secrets where name='valoria_privileged_function_invoke_key')
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
$cmd$);
