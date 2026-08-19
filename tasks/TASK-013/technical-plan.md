# TASK-013: Technical Plan

## STATUS: TECH_READY

## A) MIGRATION 45 - `fix_failed_retry_idempotency`
Create file: `supabase/migrations/20260818000045_fix_failed_retry_idempotency.sql`.

**A1) Fix `create_booking_payment`:**
- When the existing payment is in the `FAILED` state, it currently ignores the FAILED payment and proceeds to create a new one, BUT it respects the `p_idempotency_key` parameter. 
- We must change this to ignore the `p_idempotency_key` and explicitly generate a new one using `v_payment_id`:
```sql
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := 'idem_pay_' || p_booking_id || '_' || v_payment_id;
```
- We will remove the `COALESCE(p_idempotency_key, ...)` for the FAILED retry branch (or just replace it entirely). This ensures retries have unique idempotency keys regardless of what the frontend sends.

**A2) Create `mark_booking_payment_failed`:**
- Provide a new RPC to reliably mark a payment as `FAILED` in the database.
- It must only allow updating if the payment is `PENDING` or `AUTHORIZED`.
- It must ensure the payment belongs to the authenticated student and the payment is using `fake_payment_gateway`.

## B) dbService.ts - Add `markBookingPaymentFailed`
Add the corresponding method to `src/lib/db-service.ts` to call `sp.rpc('mark_booking_payment_failed', { p_payment_id, p_reason })`.

## C) CheckoutModal.tsx - Retry flow & Persistence
**C1)** Add `paymentAttemptId` state:
```typescript
const [paymentAttemptId, setPaymentAttemptId] = useState<string | null>(null);
```

**C2)** Update `handleExecuteFakePayment` (DECLINED scenario):
- If `scenario === 'DECLINED'`, call `dbService.markBookingPaymentFailed(payment.id, ...)`.
- Generate a new attempt ID: `setPaymentAttemptId(crypto.randomUUID())`.

**C3)** Update `handleExecuteFakePayment` (APPROVED scenario) / Retry flow:
- If `payment.status === 'FAILED'`, we need to create a new payment first using the attempt ID as the new idempotency key.
```typescript
let activePayment = payment;
if (activePayment.status === 'FAILED') {
  const newPayRes = await dbService.createBookingPayment(
    booking.id,
    paymentMethod,
    paymentAttemptId ? `idem_pay_${booking.id}_${paymentAttemptId}` : `idem_pay_${booking.id}_${Date.now()}`
  );
  activePayment = { ...activePayment, id: newPayRes.payment_id || newPayRes.id, status: 'PENDING', idempotencyKey: ... };
}
```
*Note*: The migration ignores the idempotency key anyway, but sending a new one makes the frontend correct logically.

## D) LIVE Database Action
- DO NOT APPLY MIGRATION 45 via pg client to the live database due to `OFFICIAL MIGRATION APPLY BLOCKED BY AUTH`.
- Only save the file locally.

## E) Tests
- Add/update tests in `tests/rpc-payment-security.test.ts` or new `tests/rpc-failed-retry.test.ts`. 
- Since the migration won't be live, these new tests should be skipped with `.skip()`.
