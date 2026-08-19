# TASK-011 Technical Plan

## STATUS: TECH_READY

## Analysis
The error `REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND` occurs because `confirm_booking_payment` is designed to reject clients trying to confirm payments created by real payment gateways directly. The issue starts when `create_booking_hold` erroneously creates the payment with `gateway_provider = 'supabase_gateway'`, making it look like a real payment.

## Required Changes

### 1. New Migration
Create a new migration (e.g., `20260818000043_fix_booking_hold_gateway.sql`) with the following adjustments:

- **Update `create_booking_hold`**:
  Ensure the inserted payment uses `gateway_provider = 'fake_payment_gateway'` and `idempotency_key = 'idem_pay_' || booking_id`.
  
- **Data-Fix**:
  Update legacy payments:
  ```sql
  UPDATE payments
  SET gateway_provider = 'fake_payment_gateway',
      idempotency_key = 'idem_pay_' || booking_id
  WHERE gateway_provider = 'supabase_gateway'
    AND idempotency_key LIKE 'pay_hold_%'
    AND status = 'PENDING';
  ```
  Ensure this doesn't violate unique constraints on `idempotency_key`.

- **Update `create_booking_payment`**:
  When checking for an existing payment, if it finds a pending one with `supabase_gateway`, it should either be treated carefully or skipped if not appropriate. For this, we'll update the function to explicitly handle `supabase_gateway` by migrating it or rejecting it.
  
### 2. Code Review
- Check `src/apps/student/components/CheckoutModal.tsx` to ensure `payment.id` from the backend is used.

### 3. Execution Steps
- Apply the migration using `npx supabase db push`.
- Test the system locally.
- Execute QA gates (`lint`, `test`, `build:all`).
