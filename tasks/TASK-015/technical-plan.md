# TASK-015: Technical Plan

## 1. CheckoutModal Component Test (`tests/rpc-payment-security.test.ts`)
- Modify `tests/rpc-payment-security.test.ts` (or the equivalent UI/unit test that handles this).
- Setup:
  - Add `// @vitest-environment happy-dom` at the top.
  - Import `render`, `screen`, `fireEvent`, `waitFor` from `@testing-library/react`.
  - Import `CheckoutModal` from `src/components/CheckoutModal.tsx` (or correct path).
- Test Case: "Deve falhar de forma segura quando o pagamento é recusado e o banco de dados falha ao marcar como falho"
  - Mock `dbService.markBookingPaymentFailed` to reject: `spy.mockRejectedValueOnce(new Error('DB error'))`.
  - Render `<CheckoutModal>` with required valid props. Set `step="PAYMENT_SELECTION"`.
  - Use `fireEvent.click(screen.getByText('Pagamento Recusado (Simular)'))` or call `handleExecuteFakePayment('DECLINED')`.
  - Assertions:
    - `dbService.markBookingPaymentFailed` called exactly 1 time.
    - `dbService.createBookingPayment`, `dbService.confirmBookingPayment`, `onBookingConfirmed` not called.
    - Assert that "Não foi possível atualizar o status do pagamento no banco de dados. Tente novamente." appears in the document.

## 2. Harden Live Test Fixtures (`tests/live/rpc-payment-security.live.test.ts`)
- Remove all `SELECT ... LIMIT 1` queries.
- In `beforeAll`:
  - Define static UUIDs for test entities.
  - Insert user, instructor, provider, vehicle, offering.
- In `afterAll`:
  - Delete ONLY the created entities by their static UUIDs.
  - Run explicit validation: `SELECT COUNT(*) FROM bookings WHERE user_id = $1` and `SELECT COUNT(*) FROM booking_payments WHERE provider_id = $1` to ensure counts are 0.
- Update Guards: Ensure `VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD` is checked properly and has no default fallback.

## 3. Quality Gates
- Linter: `npm run lint`
- Tests: `npm test`
- Build: `npm run build:all`
- Live Tests: Run `npm run test:integration:live` with correct env vars.

STATUS: TECH_READY
