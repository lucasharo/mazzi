-- TASK-096A4M-R10A: prevent new legacy vehicle review values.
-- Keep the canonical review-state contract and block non-canonical values.

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_canonical_status_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_canonical_status_check
  CHECK (
    status::text IN (
      'DRAFT',
      'PENDING',
      'IN_REVIEW',
      'ACTIVE',
      'INACTIVE',
      'EXPIRED',
      'BLOCKED'
    )
  );
