# TASK-013: Fix Payment FAILED Retry Flow

## STATUS: PRODUCT_READY

## Problem Statement
The current implementation of the payment flow has several bugs during failure and retry scenarios:
1. **FAILED retry unique violation:** The frontend sends a fixed idempotency key (`idem_pay_<booking_id>`) for any attempt. If a previous payment attempt failed (e.g., declined), retrying with the same key triggers a UNIQUE constraint violation on the `payments.idempotency_key` column instead of creating a new payment attempt.
2. **Missing Database Persistence on DECLINED:** When the fake payment gateway responds with "DECLINED", `handlePaymentFailure` updates the payment status to 'FAILED' *only in memory*. The database still considers the payment as 'PENDING'.
3. **Missing Canonical Failure RPC:** There is no dedicated RPC in the database to mark a payment as 'FAILED'.
4. **Double-click vulnerability on retry:** Fast successive clicks on "Try Again" could trigger duplicate attempts.

## Requirements
1. **Frontend Attempt Tracking:** The frontend must track individual payment attempts during checkout and generate unique idempotency keys for retries after a FAILED attempt.
2. **Backend Persists Failure:** The backend must expose an RPC (`mark_booking_payment_failed`) to definitively record a failed payment attempt. The frontend must call this RPC when a failure occurs.
3. **Backend Idempotency Fix:** The existing `create_booking_payment` RPC must be modified. If the latest payment attempt is `FAILED`, it must ignore the `p_idempotency_key` parameter and generate a fresh key, to prevent UNIQUE violations from legacy clients or hardcoded frontend keys.
4. **Resiliency to Double-clicks:** Ensure the frontend correctly blocks interactions while a retry is being processed, and rely on backend idempotency as a secondary layer.

## User Experience
- The user shouldn't notice these backend details. A declined payment will show an error message. Pressing "Try Again" will cleanly create a new transaction.
- Prevents technical error popups (like PostgreSQL unique constraint errors) on standard workflows.
