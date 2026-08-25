-- TASK-096A4M-R8: add the canonical document-review state.
-- This migration only extends the enum; data and policy normalization is in
-- the following migration so PostgreSQL can use the new enum label safely.
ALTER TYPE public.compliance_status ADD VALUE IF NOT EXISTS 'IN_REVIEW';
