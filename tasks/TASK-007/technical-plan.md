# TASK-007 — PLANO TÉCNICO: REVISÃO COMPLETA DE CANCELAMENTO + CHAT + SLOT RELEASE + NOVA COTAÇÃO + OTP 8 DÍGITOS + REFINAMENTO VISUAL

- **TASK**: TASK-007
- **STATUS**: TECH_READY
- **OWNER**: MAZZI Tech Lead
- **LAST_UPDATED**: 2026-08-18

---

# 1. Resumo Técnico

Esta entrega aborda o ciclo completo de cancelamento, re-agendamento, cotações, chat, autorização e autenticação OTP.

### 1.1 Nova Migration (`20260818000039_fix_hold_expiry_and_quote_attempt.sql`)
- **`public.is_offering_slot_available`**:
  - Executa housekeeping atômico: `UPDATE public.bookings SET status = 'EXPIRED', expired_at = NOW() WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= NOW()`.
  - Verifica conflitos ignorando reservas em `EXPIRED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_PROVIDER` e `COMPLETED`.
- **`public.create_quote_from_offering`**:
  - Quando a chave de idempotência é encontrada em `public.quotes`:
    - Se a quote estiver `ACTIVE` e `expires_at > NOW()`, retorna a quote ativa existente (`is_idempotent = true`).
    - Se a quote estiver `CONSUMED`, `EXPIRED` ou `expires_at <= NOW()`, dispara exceção `QUOTE_IDEMPOTENCY_KEY_STALE` para indicar que a tentativa/chave é histórica.

### 1.2 Frontend Checkout & Idempotency (`CheckoutModal.tsx`)
- Gerar chave de idempotência com ID de tentativa por checkout (`checkoutAttemptIdRef`):
  `const idempotencyKey = 'idem_quote_${offering.id}_${finalScheduledStartAt}_${checkoutAttemptIdRef.current}';`
- Resetar `checkoutAttemptIdRef` ao abrir o modal, fechar o modal, solicitar nova cotação ou remarcar aula cancelada.
- Ao receber `QUOTE_IDEMPOTENCY_KEY_STALE` ou `QUOTE_EXPIRED`: exibir banner amigável permitindo gerar nova cotação no mesmo horário se disponível.

### 1.3 OTP de 8 Dígitos (`AUTH_OTP_LENGTH = 8`)
- Atualizar `OtpInput.tsx` com `maxLength={8}`, `slice(0, 8)`, `label="Código de 8 dígitos"`, `placeholder="00000000"`, `value.length === 8`.
- Atualizar `AppLogin.tsx` (signup, recovery, resend, validação `otp.length !== 8`, hints e labels).

### 1.4 Modais, Action Footers & Botões Flutuantes
- `Modal.tsx`: Footer transparente (`bg-transparent border-t border-[var(--mazzi-border)]/50`).
- `BookingDetailsModal.tsx`: Botões com cantos arredondados `rounded-2xl`, sombras flutuantes e estado destrutivo vermelho semântico.
- `ProviderApp.tsx`: Modal formal de cancelamento do prestador com seleção obrigatória do `reasonCode` (`VEHICLE_ISSUE`, `PERSONAL_EMERGENCY`, `SCHEDULE_CONFLICT`, `WEATHER_OR_SAFETY`, `OPERATIONAL_ISSUE`, `OTHER`) e justificativa textual quando `OTHER`.

### 1.5 Chat & Navegação Contextual
- `BookingChatPanel.tsx`: Suporte a prop `onBack?: () => void`. Header com botão `← Voltar`, badge da aula e modo Read-Only com aviso em aulas canceladas.
- `StudentApp.tsx` & `ProviderApp.tsx`: Controle da origem (`chatOrigin: 'details' | 'list'`). Ao clicar em `← Voltar`, se a origem for `'details'`, restaura o modal de Detalhes da Aula da mesma reserva.

---

# 2. Arquivos Afetados

#### [NEW] [`20260818000039_fix_hold_expiry_and_quote_attempt.sql`](file:///d:/mazzi_premium_ui_v2/supabase/migrations/20260818000039_fix_hold_expiry_and_quote_attempt.sql)
#### [NEW] [`auth-constants.ts`](file:///d:/mazzi_premium_ui_v2/src/lib/auth-constants.ts)
#### [MODIFY] [`OtpInput.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/ui/OtpInput.tsx)
#### [MODIFY] [`AppLogin.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/auth/AppLogin.tsx)
#### [MODIFY] [`Modal.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/ui/Modal.tsx)
#### [MODIFY] [`CheckoutModal.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/components/CheckoutModal.tsx)
#### [MODIFY] [`BookingDetailsModal.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/components/BookingDetailsModal.tsx)
#### [MODIFY] [`BookingChatPanel.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/chat/BookingChatPanel.tsx)
#### [MODIFY] [`StudentApp.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
#### [MODIFY] [`ProviderApp.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/provider/ProviderApp.tsx)
#### [MODIFY] [`availability.ts`](file:///d:/mazzi_premium_ui_v2/src/domain/availability.ts)
#### [MODIFY] [`db-service.ts`](file:///d:/mazzi_premium_ui_v2/src/lib/db-service.ts)
#### [NEW] [`cancellation-and-rebooking-flow.test.ts`](file:///d:/mazzi_premium_ui_v2/tests/cancellation-and-rebooking-flow.test.ts)

---

# 3. Ordem de Implementação

1. **Migration 39**: `20260818000039_fix_hold_expiry_and_quote_attempt.sql`.
2. **OTP Constants & Components**: `auth-constants.ts`, `OtpInput.tsx`, `AppLogin.tsx`.
3. **Idempotency & Attempt Key Fix**: `CheckoutModal.tsx`, `availability.ts`, `db-service.ts`.
4. **Modais & Layout (UI)**: `Modal.tsx`, `BookingDetailsModal.tsx`, `ProviderApp.tsx` (modal cancelamento prestador).
5. **Chat & Navegação Contextual**: `BookingChatPanel.tsx`, `StudentApp.tsx`, `ProviderApp.tsx`.
6. **Suíte de Testes Automatizados**: `cancellation-and-rebooking-flow.test.ts` e execução de quality gates (`npm run lint`, `npm test`, `npm run build:all`).

---

# 4. Handoff para MAZZI Dev

Pronto para execução imediata.
