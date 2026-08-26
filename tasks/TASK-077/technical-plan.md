# Technical Plan — TASK-077

TASK: TASK-077
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-26

## Architecture decision

The delivery is split into three explicit contracts:

1. A forward-only Supabase migration owns first-time instructor availability and notification `app_context`. It never modifies historical migrations, provider activation, payment behavior, or RLS ownership rules.
2. `dbService` exposes the notification context boundary. Student, PRO, and Admin pass their own context; unread counts and read mutations are therefore scoped consistently.
3. The existing PRO management feedback surfaces are reused for vehicle lifecycle errors; native browser alerts are removed from the affected vehicle/offering path.

## Data plan

- Add `app_context` (`STUDENT`, `PRO`, `ADMIN`) to notifications, backfill safely from the related booking/conversation/review recipient, index by recipient/context/unread, and populate new rows with a server-side trigger. Existing RLS remains in force.
- Add a one-time `provider_schedule_bootstrap` marker. `onboard_my_instructor()` inserts only Monday–Friday, 08:00–18:00 availability with the newly created/reused instructor provider. The marker is inserted only when the defaults are created; subsequent onboarding/retries and user edits/deletes do not restore rows.
- Do not create availability for a school provider because it has no schedulable instructor/vehicle resource at onboarding time.

## Frontend plan

- Add a shared CNPJ checksum validator to the input-mask module; validate before the RPC and keep the database RPC authoritative.
- Map CNPJ server errors to concise Portuguese feedback.
- Give `NotificationsPanel` an explicit context prop and pass `STUDENT`, `PRO`, or `ADMIN` from each PWA.
- Replace vehicle/offering native alerts with the existing management error state, preserving backend validation and current status transitions.

## Test plan

- Extend onboarding tests for CNPJ validation/error mapping and one-time weekday availability bootstrap.
- Add notification context tests for list/count/read isolation and app callers.
- Add vehicle feedback regression assertions that prohibit `alert()` in the affected handler path.
- Run focused tests, full suite, lint, all builds, diff check, and DEV-only migration validation before release.

## Security review

- New functions/triggers use fixed `search_path`.
- No frontend role, provider, school, or context authority is accepted for persisted data.
- Notification RLS is retained; context is an additional filter, never an authorization bypass.
- Supabase Production and payment remain untouched.
