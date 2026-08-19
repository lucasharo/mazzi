# TASK-012: Fix FAILED Retry Invalid Columns, Hold Expired UX, and Security Cleanup

## Context
1. **Security**: Hardcoded PostgreSQL credential in commit 40bf3d9 (already removed from current HEAD but present in history). Need rotation, do NOT rewrite history.
2. **Backend**: Migration 43 has a bug in `create_booking_payment` where FAILED retry attempts to insert non-existent columns (`student_id`, `provider_id`, `platform_fee_in_cents`, `provider_amount_in_cents`).
3. **Backend**: Idempotency key for FAILED retry needs to be unique.
4. **Backend/Service**: `dbService` does not handle `success: false` and `error: 'BOOKING_HOLD_EXPIRED'` from `create_booking_payment` RPC.
5. **Frontend**: The frontend shows an incorrect message when the hold expires. It should say 'Tempo para pagamento expirado. O agendamento foi cancelado.' and hide payment buttons.

## Requirements
1. **Security Cleanup**: Commit the sanitized `apply-migration-043.mjs`. Document the need for credential rotation.
2. **Migration 44**: Create and apply a new migration to fix `create_booking_payment`:
    - Remove invalid columns in the `INSERT`.
    - Ensure FAILED retry generates a unique `idempotency_key`.
    - Preserve security checks and other existing logic.
3. **Service layer**: Update db service to throw a `BOOKING_HOLD_EXPIRED` error.
4. **Frontend**: Update `CheckoutModal.tsx` to handle the `BOOKING_HOLD_EXPIRED` domain error correctly.

STATUS: PRODUCT_READY
