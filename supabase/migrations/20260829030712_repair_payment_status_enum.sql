-- Repair payment status values required by payment-attempt switching.
-- Some environments have the payments migration recorded as applied while
-- these enum labels were not present in the live type.
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'CANCELLED';
