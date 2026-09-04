# TASK-096A4 reconciliation evidence

## Authority

LIVE is authoritative. Read-only LIVE checks confirmed 30 public tables, 416 public columns, 1,027 public functions, and 94 SECURITY DEFINER functions. Historical replay is auxiliary evidence only.

## Candidate changes

- Removed `financial_events`, `payment_webhook_events`, and `provider_payment_accounts`, absent from LIVE.
- Removed the historical 10-argument `search_providers_public` overload; the current 11-argument overload remains.
- Removed the historical `process_booking_refund` definition.
- Replaced `confirm_booking_payment` with the exact read-only LIVE definition.
- No active migration under `supabase/migrations` was changed.

## R12A canonical alignment

The baseline candidate now includes the canonical R10D terms helper, server-side `v1` enforcement, provider activation eligibility, USER_GLOBAL/PROVIDER auto-activation trigger, and R11 provider/offering lifecycle trigger. The existing `admin_refund_mock_booking`/`process_booking_refund` finding remains outside this R12A scope and is not reintroduced into the baseline.

Baseline candidate status: CANONICAL / ALIGNED for the R10D/R11 domains.
Supabase DEV reference date: 2026-08-25.
Covered through migration: `20260825172601_enforce_provider_offering_lifecycle_consistency`.

## Geoapify location contract

DEV migration `20260825223009_geoapify_provider_address` was applied forward-only.
It adds `providers.address` (JSONB) and `providers.postal_code`, and replaces the
legacy eight-argument `update_provider_profile` contract with the twelve-argument
authenticated SECURITY DEFINER function that persists normalized address data and
exact provider latitude/longitude. Public search continues to use the existing
public coordinate projection; exact coordinates are not added to public RPC output.

## Multi-role self-booking contract

The baseline candidate includes the forward-only `20260825211702_prevent_student_self_booking`
contract. It centralizes authenticated identity conflict resolution and applies it to
public search, provider booking context, available slots, quote creation, and booking
hold creation. Anonymous search remains executable, while driving-school offerings
assigned to another instructor remain eligible for a Student who is only a school member.

## Validation status

The schema candidate remains separate from the active migration tree and contains no operational user/provider/booking/payment data. The reference-data file contains only the non-PII canonical terms requirement. Fresh-database replay was not run because Docker is unavailable and is not a gate for this task.

## TASK-089 Aula Agora

The forward-only migrations `20260904011639_task_089_instant_lesson.sql` and `20260904160000_task_089_instant_lesson_blockers_and_rbac_fix.sql` were applied to DEV through the Supabase migration tool. All core Aula Agora RPCs (including multi-role support via `user_has_role`, RBAC location isolation, accurate schedule window travel estimation, and provider count deduplication) are present and verified in `public`.
