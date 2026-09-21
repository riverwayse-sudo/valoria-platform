-- Session 02 meeting automation configuration.
-- Keeps the live meeting link and enabled state reproducible in fresh environments.

update public.lead_automation_configs
set meeting_link = 'https://meet.google.com/qfj-aknp-wvj',
    enabled = true,
    send_delay_seconds = 0,
    updated_at = now()
where event_session_id = '02'
  and source in ('meta_lead_ads', 'event_registration');
