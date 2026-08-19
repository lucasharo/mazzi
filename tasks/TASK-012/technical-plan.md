# TASK-012: Technical Plan

## 1. Security Cleanup
- Execute `git add scripts/apply-migration-043.mjs` and `git commit -m "security: remove hardcoded DB credential from apply-migration-043.mjs (TASK-012)"`.
- Do NOT rewrite history. State that SECRET IN CURRENT HEAD=NO, SECRET IN PRIOR HISTORY=YES, ROTATION REQUIRED=YES.

## 2. Migration 44
- Query `supabase_migrations.schema_migrations` to determine the next migration number (likely 44).
- Create `supabase/migrations/20260818000044_fix_create_booking_payment_failed_retry.sql`
- Update `create_booking_payment`:
  - Modify the `INSERT INTO public.payments` for the new payment attempt.
  - Omit `student_id`, `provider_id`, `platform_fee_in_cents`, `provider_amount_in_cents` as they don't exist in `public.payments`.
  - Provide a generated UUID for `v_payment_id`.
  - Set `v_effective_idem_key := COALESCE(p_idempotency_key, 'idem_pay_' || p_booking_id || '_' || v_payment_id);`
  - Insert only valid columns: `id, booking_id, method, status, amount_in_cents, idempotency_key, gateway_provider, created_at, updated_at`.
- Use a Node script `scripts/apply-migration-044.mjs` (reading from `DATABASE_URL` via process.env) to apply the migration SQL and insert into `supabase_migrations.schema_migrations`.

## 3. Service Layer Fix
- In `src/lib/db-service.ts`, around line 796, inside `createBookingPayment`, check if `data.success === false && data.error === 'BOOKING_HOLD_EXPIRED'`.
- If so, throw `new Error('BOOKING_HOLD_EXPIRED')`.

## 4. Frontend Fix
- In `src/apps/student/components/CheckoutModal.tsx`, around line 217 and also inside `handlePayment` catch blocks.
- Check for `err?.message?.includes('BOOKING_HOLD_EXPIRED')`.
- If true:
  - Set error message to `'Tempo para pagamento expirado. O agendamento foi cancelado.'`.
  - Change step to `'ERROR_QUOTE_EXPIRED'` but adapt the text of `ERROR_QUOTE_EXPIRED` to display the `errorMessage` correctly so that the UI hides payment buttons and displays exactly the requested text.

STATUS: TECH_READY
