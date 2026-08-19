TASK: TASK-009
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-08-18T21:52:00-03:00

# O que foi Implementado

1. **Redesign Estrutural dos Modais de Checkout (`CheckoutModal.tsx`):**
   - **Confirmar sua aula (Quote Preview):** Hierarquia visual limpa e elegante, fundo `#f7f5ef`, badge de retenção de cotação discreto em tom âmbar suave ("Este valor fica reservado por mais MM:SS"), resumo da aula escaneável (prestador, instrutor, data, horário, veículo, transmissão, categoria), seletor de ponto de encontro acessível (min-height >= 44px com destaque visual no selecionado), resumo de preços claro com destaque no Total e CTA principal `[ Continuar para pagamento ]` com min-height de 48px.
   - **Confirmar pagamento (Payment Selection):** Banner "Ambiente de Testes" secundário e não intrusivo, seletor de forma de pagamento (PIX / Cartão) com touch-target >= 44px, resumo do total e CTA `[ Confirmar pagamento ]` com min-height >= 48px, proteção contra duplo clique e estados de carregamento e erro humanizados.
   - **Footer Flutuante:** Ausência de placas brancas pesadas atrás dos botões, respeitando o padrão de modal/footer flutuante com suporte a safe-area.

2. **Regra de Classificação Temporal para o Histórico de Aulas (`StudentApp.tsx` & `src/domain/booking.ts`):**
   - Implementadas as funções puras de domínio `getBookingEndTimestamp` e `isBookingEnded`.
   - A aba "Próximas aulas" exibe apenas agendamentos cujo horário de término seja estritamente no futuro (`scheduled_end_at > NOW()`).
   - A aba "Histórico" exibe automaticamente qualquer agendamento cujo `scheduled_end_at <= NOW()`, independentemente de o status no banco ainda ser `CONFIRMED` ou `IN_PROGRESS`.
   - O status do objeto de agendamento é preservado (sem alterações ilegítimas na propriedade `status`).

3. **Transição Automática sem Restart (`StudentApp.tsx`):**
   - Criado timer reativo leve no frontend que calcula a data de término da próxima aula ativa e agenda um re-render automático para mover o agendamento da aba Próximas para a aba Histórico no exato segundo em que a aula termina, sem necessidade de recarga da página ou logout/login.

4. **Ações para Aulas Passadas (`BookingDetailsModal.tsx`):**
   - Para aulas cujo término já passou (`isLessonEnded`), os botões de cancelamento ("Cancelar aula") e pagamento ("Finalizar pagamento") são automaticamente ocultados, mantendo apenas ações relevantes como "Ver Chat" e informações históricas.

5. **Design System & Testes (`DesignSystemShowcase.tsx` & `tests/task-009-pending-payment-and-refinements.test.ts`):**
   - Atualizada a vitrine com exemplos visuais de cards de aulas passadas com status `CONFIRMED` no Histórico e especificações dos modais de checkout.
   - Criada suíte completa com 25 testes cobrindo os cenários de A até H de classificação temporal, o timer de transição automática e os refinamentos de microcopy dos modais.

# Arquivos Alterados

* `[MODIFY]` [CheckoutModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/CheckoutModal.tsx)
* `[MODIFY]` [BookingDetailsModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/BookingDetailsModal.tsx)
* `[MODIFY]` [StudentApp.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
* `[MODIFY]` [booking.ts](file:///D:/mazzi_premium_ui_v2/src/domain/booking.ts)
* `[MODIFY]` [DesignSystemShowcase.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/design-system/DesignSystemShowcase.tsx)
* `[MODIFY]` [task-009-pending-payment-and-refinements.test.ts](file:///D:/mazzi_premium_ui_v2/tests/task-009-pending-payment-and-refinements.test.ts)

# Decisões Técnicas Tomadas

* A lógica de término da aula foi migrada para o domínio (`src/domain/booking.ts`), permitindo reutilização e testes isolados em ambiente Node/Vitest sem dependências de DOM.
* A microcopy do modal de checkout foi tornada estritamente humana ("Este valor fica reservado por mais", "Aula prática", "Taxa de serviço", "Total"), removendo jargões técnicos.

# Testes Executados

* `npm run lint`: **0 erros**.
* `npm test`: **510 testes em 56 arquivos com 100% de aprovação**.
* `npm run build:all`: Builds de `student`, `instructor` e `admin` compiladas com código 0.
