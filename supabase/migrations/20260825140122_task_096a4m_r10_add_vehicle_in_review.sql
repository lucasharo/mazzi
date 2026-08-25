-- TASK-096A4M-R10A: canonical vehicle review status.
-- Enum extension is isolated so the next migration can safely use IN_REVIEW.
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'IN_REVIEW';
