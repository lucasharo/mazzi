# TASK-013: Implementation Report

## STATUS: READY_FOR_QA

## 1. MIGRATION 45
Confirmed that migration `20260818000045_fix_failed_retry_idempotency.sql` is live on Supabase.
- `supabase_migrations.schema_migrations` contains `20260818000045`.
- `mark_booking_payment_failed(uuid, varchar)` is present in `pg_proc`.
- Permissions for `create_booking_payment` and `mark_booking_payment_failed` include `authenticated` and `service_role`.

## 2. FIX FAIL-CLOSED NO DECLINED (CheckoutModal.tsx)
- Updated `CheckoutModal.tsx` to throw an error (`throw new Error('PAYMENT_MARK_FAILED_ERROR: ...')`) if the call to `dbService.markBookingPaymentFailed` fails.
- This prevents the local state from diverging from the database and prevents silently generating a new `paymentAttemptId` if the backend didn't actually record the failure.
- A user-friendly error message is displayed when this happens.

## 3. REAL INTEGRATION TESTS (rpc-payment-security.test.ts)
- Removed `.skip()` from all tests in `TASK-013`.
- Converted them to real database tests against the Supabase backend using `PgClient` for data injection (to bypass frontend validation complexities and RLS for bookings creation) and `dbService`/`supabase` client for testing the RPCs.
- **Test 1**: Creates a booking, executes payment, marks as failed (`SIMULATED_DECLINED`), verifies state (`FAILED`/`PENDING_PAYMENT`), creates a new payment with retry idempotency, and confirms it.
- **Test 2**: Spies on `markBookingPaymentFailed` to simulate a mocked DB error to ensure the fail-closed behavior.
- **Test 3**: Injects a booking and rapidly fires `create_booking_payment` twice to verify idempotency. Confirms that only 1 `PENDING` payment exists in the database.

## 4. QUALITY GATES
- `npm run lint`: 0 errors.
- `npm test tests/rpc-payment-security.test.ts`: 100% PASS (6 passed, 0 skipped/failed).
- `npm run build:all`: Builds successful for student, instructor, and admin apps.
