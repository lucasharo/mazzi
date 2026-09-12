-- Ensure the canonical review state exists before historical
-- policies and RPCs begin referencing it.
ALTER TYPE public.compliance_status
  ADD VALUE IF NOT EXISTS 'IN_REVIEW';
