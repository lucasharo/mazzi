# TASK-011 Requirement: Fix Booking Hold Gateway

## STATUS: PRODUCT_READY

## Background
A critical bug was found in the live system: users receive a 403 error during `confirm_booking_payment` (message: `REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND`).
The root cause is that `create_booking_hold` creates a payment with `gateway_provider = 'supabase_gateway'`. Later, `create_booking_payment` (from Migration 42) reuses this payment. The confirmation function rightfully rejects it because the gateway isn't `fake_payment_gateway`.

## Objectives
1. **Fix create_booking_hold**: Create payments with `gateway_provider = 'fake_payment_gateway'` and `idempotency_key = 'idem_pay_' || booking_id`.
2. **Data-Fix**: Migrate legacy pending payments to use `fake_payment_gateway` and update their idempotency keys.
3. **Fix create_booking_payment**: Handle existing payments with `supabase_gateway` explicitly (migrate or reject).
4. **Preserve Rules**:
   - `confirm_booking_payment` must retain its security check.
   - Preserver hold expiration behavior.
   - Prevent duplicate payments.

## Constraints
- Do not edit migrations 41 or 42.
- Create a new migration for the fix.
- Work on branch `premium_ui_v2`.
- Do not affect the historic `student_id` conflicts from TASK-009.
