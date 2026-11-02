begin;

-- A delivery timestamp plus a persisted report proves the email was sent.
-- Reconcile older rows that retained EMAIL_PENDING after successful delivery.
update public.valu_assessments
set report_status = 'SENT',
    report_locked_at = null,
    report_failure_code = null
where completed_at is not null
  and report_status = 'EMAIL_PENDING'
  and report_email_sent_at is not null
  and ai_report is not null;

commit;
