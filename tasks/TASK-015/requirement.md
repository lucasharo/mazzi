# TASK-015: CheckoutModal Fail-Closed Component Test and Harden Live Test Fixtures

## 1. Product Requirements
- **Goal:** Improve robustness of CheckoutModal tests and ensure LIVE test fixtures are completely isolated and clean up correctly.
- **Fail-Closed Component Test:**
  - Replace direct mock invocation with a real render/interaction component test for CheckoutModal using `@testing-library/react`.
  - Validate that when a database update fails during a declined payment (`dbService.markBookingPaymentFailed` rejects), the system fails securely.
  - The payment processing must abort and display a specific user-friendly error message: "Não foi possível atualizar o status do pagamento no banco de dados. Tente novamente."
- **Harden Live Test Fixtures:**
  - Tests running against the live database must never rely on existing data (`SELECT ... LIMIT 1`).
  - Strict setup and teardown of dedicated test fixtures (Providers, Vehicles, Offerings, Users) must be implemented.
  - Ensure 100% cleanup of test data with explicit validation.
- **Isolation:**
  - Standard tests must never connect to the live DB.
  - Live tests must fail fast if required environment variables are missing (no default fallbacks).

## 2. Status
STATUS: PRODUCT_READY
