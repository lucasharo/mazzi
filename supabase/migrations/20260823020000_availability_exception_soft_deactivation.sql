-- Preserve availability exception history while allowing operational deactivation.
ALTER TABLE public.availability_exceptions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_active_range
  ON public.availability_exceptions (provider_id, is_active, start_at, end_at);
