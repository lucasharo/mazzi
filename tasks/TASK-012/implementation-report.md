# TASK-012: Implementation Report

## Actions Taken
1. **Security Cleanup**: Committed `scripts/apply-migration-043.mjs` without hardcoded DB credentials.
2. **Migration 44 applied**: Created and applied `20260818000044_fix_create_booking_payment_failed_retry.sql`.
   - The migration uses ONLY valid columns in the `public.payments` table (`id`, `booking_id`, `method`, `status`, `amount_in_cents`, `idempotency_key`, `gateway_provider`, `created_at`, `updated_at`).
   - Ensures UUID-based unique `idempotency_key` for `FAILED` retry attempts.
   - Hold expiration correctly returns a JSON error, preventing rollbacks.
3. **Service update**: Updated `src/lib/db-service.ts` to detect `data.success === false && data.error === 'BOOKING_HOLD_EXPIRED'` and throw `BOOKING_HOLD_EXPIRED`.
4. **Frontend update**: Modified `src/apps/student/components/CheckoutModal.tsx`:
   - Updated the error message state to `'Tempo para pagamento expirado. O agendamento foi cancelado.'` when catching `BOOKING_HOLD_EXPIRED`.
   - Handled the UI step transition to `'ERROR_QUOTE_EXPIRED'` and modified the UI to correctly display the error message.
5. **Testing**: Appended a test case to `tests/rpc-payment-security.test.ts` to verify the new error throwing logic. Tests passed successfully.

STATUS: READY_FOR_QA
