-- Transactional email delivery runs in a service-role Edge Function. Keep the
-- public tables protected from client roles while granting the worker the
-- read-only surface required to assemble canonical email payloads.
GRANT SELECT ON TABLE
  public.users,
  public.bookings,
  public.providers,
  public.vehicles,
  public.service_offerings,
  public.payments,
  public.refunds,
  public.payouts,
  public.provider_bank_accounts
TO service_role;
