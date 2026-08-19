# TASK-014 Requirements

## 1. Context and Goals
Separate live integration tests from the standard test suite to prevent accidental connections and data mutations in the Supabase LIVE environment when running `npm test`. Introduce strict guards for live tests.

## 2. Mandatory Requirements
### Separation of Tests
- `npm test` MUST NOT connect or mutate Supabase LIVE.
- In `package.json`:
  - `"test"`: `"vitest run --exclude '**/*.live.test.ts'"`
  - `"test:integration:live"`: `"vitest run --dir tests/live"`
- Move tests that interact with LIVE DB to `tests/live/rpc-payment-security.live.test.ts`.

### Guards & Fallback Removal
- In `tests/live/rpc-payment-security.live.test.ts`:
  - REMOVE fallback `|| 'teste123'`. Use strictly: `const password = process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD;`.
  - Add FAIL FAST guard in `beforeAll`:
    If `process.env.RUN_LIVE_INTEGRATION_TESTS !== 'true'` OR `!process.env.DATABASE_URL` OR `!password`, throw error `LIVE_TEST_GUARD_FAILED: Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true, DATABASE_URL, and VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD.`.

### Unit and Component Tests (No Live)
- Keep `tests/rpc-payment-security.test.ts` as pure unit/mock suite.
- Add Component Fail-Closed Test (CheckoutModal):
  - Mock `dbService.markBookingPaymentFailed` to reject.
  - Verify error is caught without false state changes, `createBookingPayment` is not called, and user message is shown.
- Add Flow Retry Test (Unit, No Live):
  - Payment in FAILED -> Retry -> `createBookingPayment` returns UUID-B -> `confirmBookingPayment` receives UUID-B.

### Live Dedicated Tests
- Preserve real integration tests in `tests/live/rpc-payment-security.live.test.ts` (FAILED -> Retry -> Confirmed, Fail-closed error handling, Double click concurrency).
- Use isolated test IDs/fixtures and ensure cleanup in `afterAll`.

### Quality Gates
- `npm run lint` -> PASS
- `npm test` -> PASS (No LIVE connections)
- `npm run build:all` -> PASS
- Live tests -> PASS with correct env vars

STATUS: PRODUCT_READY
