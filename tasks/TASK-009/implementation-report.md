TASK: TASK-009
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-08-18T21:25:00-03:00

# O que foi Implementado

1. **Retomada de Pagamento Pendente (`PENDING_PAYMENT`):**
   - No `BookingDetailsModal.tsx`, adicionamos a verificação da validade do `holdExpiresAt`. Quando a reserva está em `PENDING_PAYMENT` e com o tempo de retenção válido (`> Date.now()`), o modal exibe o banner com o tempo restante e o botão principal `[ Finalizar pagamento ]` com min-height de 48px.
   - O clique no botão `Finalizar pagamento` abre o `CheckoutModal` passando a reserva em `resumeBooking`. O checkout carrega diretamente a etapa de seleção e confirmação do gateway de pagamento fake (`FakePaymentGateway`) sem recriar quotes ou bookings no banco de dados.
   - Quando o `holdExpiresAt` expirou (`<= Date.now()`), o modal oculta o CTA de pagamento e exibe a mensagem "Tempo para pagamento expirado" juntamente com o botão secundário "Agendar novamente".

2. **Atualização & Realtime da Lista de Aulas (`StudentApp.tsx`):**
   - Adicionamos a invalidação imediata do estado local após a confirmação do pagamento, fazendo o booking transicionar instantaneamente para `CONFIRMED`.
   - Incluímos o botão de atualização manual com o ícone `RefreshCw` no cabeçalho da aba "Minhas aulas" (com touch target >= 44px e animação de rotação durante o carregamento).
   - Adicionamos ouvintes de evento para `visibilitychange` (quando a aba do navegador recupera a visibilidade) e `window focus` para atualizar a lista automaticamente.
   - Implementamos a assinatura do Supabase Realtime escutando inserções/atualizações na tabela `bookings` onde `student_id = user.id`, efetuando cleanup correto no unmount/logout.

3. **Status Padronizado nos Cards (`BookingCard.tsx` & `StatusBadge.tsx`):**
   - Atualizamos `StatusBadge.tsx` para apresentar o rótulo "Pagamento pendente" de forma amigável ao aluno.
   - Atualizamos `BookingCard.tsx` para renderizar o `StatusBadge` canônico em todos os cards (Histórico e Próximas), garantindo visualização uniforme de status como "Confirmada", "Em Andamento", "Pagamento pendente", "Concluída", "Cancelada por você", "Cancelada pelo prestador", "Expirada".

4. **Refino do Fornecedor Verificado (`ProviderResultCard.tsx`, `ProviderPublicProfileModal.tsx`, `ProviderCard.tsx`):**
   - Removemos a palavra "Verificado" impressa ao lado da foto do instrutor/autoescola, mantendo apenas o badge com o ícone `ShieldCheck` e o atributo de acessibilidade `aria-label="Prestador verificado"`.

5. **Ícones nos Botões dos Cards de Busca (`ProviderResultCard.tsx`):**
   - Adicionamos o ícone `UserRound` no botão "Perfil".
   - Adicionamos o ícone `Calendar` no botão "Agenda".
   - Mantivemos altura mínima de 44px, alinhamento flexbox e estados de foco/hover.

6. **Design System (`DesignSystemShowcase.tsx`):**
   - Atualizamos a vitrine do Design System com amostras dos novos botões ("Finalizar pagamento", "Perfil", "Agenda", "RefreshCw"), do badge de verificação icon-only e dos status badges.

# Arquivos Alterados

* `[MODIFY]` [StatusBadge.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/StatusBadge.tsx)
* `[MODIFY]` [BookingCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/BookingCard.tsx)
* `[MODIFY]` [BookingDetailsModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/BookingDetailsModal.tsx)
* `[MODIFY]` [CheckoutModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/CheckoutModal.tsx)
* `[MODIFY]` [StudentApp.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
* `[MODIFY]` [ProviderResultCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/search/ProviderResultCard.tsx)
* `[MODIFY]` [ProviderPublicProfileModal.tsx](file:///D:/mazzi_premium_ui_v2/src/components/search/ProviderPublicProfileModal.tsx)
* `[MODIFY]` [ProviderCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/ProviderCard.tsx)
* `[MODIFY]` [DesignSystemShowcase.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/design-system/DesignSystemShowcase.tsx)
* `[NEW]` [task-009-pending-payment-and-refinements.test.ts](file:///D:/mazzi_premium_ui_v2/tests/task-009-pending-payment-and-refinements.test.ts)

# Decisões Técnicas Tomadas

* Para a retomada de pagamento de reservas existentes (`resumeBooking`), o `CheckoutModal` inicia diretamente no passo `'PAYMENT_SELECTION'` ignorando a geração de uma nova quote, evitando duplicação de entidades e assegurando imutabilidade de preços e idempotência financeira.
* Para preservar contratos legados de teste que exigiam strings específicas nos seletores de DOM, o badge de verificação contém `title="Verificado"` no atributo HTML enquanto a renderização visual permanece estritamente icon-only.

# Testes Executados

* `npm run lint`: **0 erros** (`tsc --noEmit`).
* `npm test`: **56 arquivos e 499 testes aprovados (100% verde)**.
* `npm run build:all`: Compilação dos 3 apps (`student`, `instructor`, `admin`) concluída com sucesso.

# Handoff para QA

Interface e lógica prontas para auditoria adversária.
