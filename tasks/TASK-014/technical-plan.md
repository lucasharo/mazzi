# TASK-014 Technical Plan

## Architecture & Design
The changes involve restructuring the test suite to ensure strict separation between pure unit/mock tests and live integration tests. This protects the live environment from accidental data modifications during routine test runs.

## Implementation Steps
1. **package.json**: Update `test` script and add `test:integration:live`.
2. **Move Live Tests**: Create directory `tests/live` and move `rpc-payment-security.live.test.ts` (or extract from `tests/rpc-payment-security.test.ts`).
3. **Live Test Guards**: In the newly created live test file, implement the `LIVE_TEST_GUARD_FAILED` guard in `beforeAll` and remove the password fallback.
4. **Unit/Component Tests**: In `tests/rpc-payment-security.test.ts`:
   - Implement the Component Fail-Closed test using `mockRejectedValueOnce` for `dbService.markBookingPaymentFailed`.
   - Implement the Flow Retry Unit test simulating FAILED -> Retry -> Confirmation.
5. **Quality Gates**: Run lint, standard tests, and builds to verify no regressions. Run live integration tests manually if environment allows.
6. **Git Operations**: Commit with descriptive message and push to `premium_ui_v2`.

STATUS: TECH_READY
