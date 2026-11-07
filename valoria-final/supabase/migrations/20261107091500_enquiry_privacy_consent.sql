-- Record explicit acknowledgement for public Marketplace enquiries.
-- Existing rows remain false: historical submissions are not retroactively treated as consented.
BEGIN;

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_notice_version text;

COMMENT ON COLUMN public.enquiries.privacy_consent
  IS 'Whether the buyer explicitly acknowledged the privacy notice before submitting the enquiry.';
COMMENT ON COLUMN public.enquiries.privacy_consent_at
  IS 'Timestamp of the buyer privacy notice acknowledgement.';
COMMENT ON COLUMN public.enquiries.privacy_notice_version
  IS 'Version identifier of the privacy notice presented at submission.';

COMMIT;
