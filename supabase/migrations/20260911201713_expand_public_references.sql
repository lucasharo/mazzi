-- Expand user-facing references without changing existing values.
-- Existing references remain valid for previously sent emails and deep links.

ALTER TABLE public.bookings
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-LESSON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

ALTER TABLE public.payments
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

ALTER TABLE public.payouts
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-PAYOUT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
