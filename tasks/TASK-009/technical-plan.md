TASK: TASK-009 (Ajuste Checkout Modais & Classificação Temporal do Histórico)
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-18T21:46:00-03:00

# Resumo Técnico

Esta atualização reestrutura os modais de checkout ("Confirmar sua aula" e "Confirmar pagamento") em estrita observância das diretrizes de UI/UX do MAZZI Premium V2 (design system, hierarquia de tipos, microcopy humanizada, resumo de preço e botões de ação flutuantes) e implementa a regra rigorosa de classificação temporal de agendamentos para a aba "Histórico" baseada no término do evento (`scheduled_end_at <= NOW()`), incluindo reclassificação automática em tempo real por timer.

# Arquivos Afetados

* `[MODIFY]` [StudentApp.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
* `[MODIFY]` [CheckoutModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/CheckoutModal.tsx)
* `[MODIFY]` [BookingDetailsModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/BookingDetailsModal.tsx)
* `[MODIFY]` [DesignSystemShowcase.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/design-system/DesignSystemShowcase.tsx)
* `[MODIFY]` [task-009-pending-payment-and-refinements.test.ts](file:///D:/mazzi_premium_ui_v2/tests/task-009-pending-payment-and-refinements.test.ts)

# Estratégia de Implementação

1. **Classificação Temporal de Histórico em `StudentApp.tsx`:**
   - Criar a função auxiliar `isBookingEnded(booking: Booking, nowMs: number): boolean` baseada no `scheduledEndAt` (com fallbacks para `scheduledDate + endTime` ou `scheduledDate + startTime + duration`).
   - Manter um estado reativo de relógio `nowMs` atualizado periodicamente ou via timer pontual agendado para o momento exato do próximo `scheduled_end_at`.
   - Filtrar `upcomingBookings`: agendamentos onde `!isBookingEnded(b, nowMs)` E (status = `CONFIRMED` ou `IN_PROGRESS` ou (`PENDING_PAYMENT` com hold válido)).
   - Filtrar `historyBookings`: agendamentos onde `isBookingEnded(b, nowMs)` OU status terminal (`COMPLETED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_PROVIDER`, `EXPIRED`, `NO_SHOW_STUDENT`, `NO_SHOW_PROVIDER`, `REFUNDED`).
   - Garantir que a classificação no frontend não modifique a propriedade `status` do objeto de reserva (um booking `CONFIRMED` que já acabou continua com `status = 'CONFIRMED'`, porém é renderizado no Histórico).

2. **Ações para Aulas Passadas no `BookingDetailsModal.tsx`:**
   - Se `isBookingEnded(booking)`, ocultar ações ativas como "Cancelar aula" e "Finalizar pagamento", exibindo apenas "Ver Chat", "Avaliar aula" e detalhes informativos.

3. **Redesign do Modal "Confirmar sua aula" (Quote Preview) em `CheckoutModal.tsx`:**
   - **Títulos e Tópicos:** Subtítulos discretos, sem textos técnicos.
   - **Countdown:** Tratar como aviso delicado ("Este valor fica reservado por mais MM:SS"), utilizando badge âmbar suave.
   - **Seletor de Ponto de Encontro:** Botões com touch target >= 44px e bordas destacadas para o item selecionado.
   - **Resumo Financeiro:** Visualmente limpo com hierarquia destacada no Total.
   - **Ação Principal:** `PrimaryButton` `[ Continuar para pagamento ]` com min-height >= 48px e full width no mobile.

4. **Redesign do Modal "Confirmar pagamento" (Payment Selection) em `CheckoutModal.tsx`:**
   - **Banner de Teste:** Nota de rodapé discreta ("Ambiente de Testes: Pagamento simulado sem cobrança real"), sem competir visualmente com o CTA.
   - **Seleção de Pagamento:** Cards com min-height >= 44px e estados selecionados evidentes.
   - **Ação Principal:** `PrimaryButton` `[ Confirmar pagamento ]` com min-height >= 48px, proteção contra duplo clique e estado de carregamento.

5. **Design System & Testes:**
   - Atualizar `DesignSystemShowcase.tsx` com exemplos visuais de cards de aulas passadas classificadas no Histórico e modais de checkout.
   - Escrever testes unitários em `task-009-pending-payment-and-refinements.test.ts` cobrindo as regras de classificação temporal (Cenários A a H) e a virada de tempo sem restart do app.
