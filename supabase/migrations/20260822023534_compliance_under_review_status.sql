-- Uploaded compliance documents wait for review before approval or rejection.
ALTER TYPE public.compliance_status ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
