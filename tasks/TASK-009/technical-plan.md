TASK: TASK-009
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-18T21:20:00-03:00

# Resumo Técnico

Esta tarefa estende o fluxo de agendamento do MAZZI trazendo a capacidade de retomada direta de pagamentos pendentes (`PENDING_PAYMENT`), sincronização de agendamentos (invalidação imediata, refresh manual via cabeçalho, eventos de visibilidade de janela e Supabase Realtime), uniformização de status humanos via `StatusBadge` nos cards de agendamento/histórico, refino dos badges de verificação do fornecedor (apenas ícone sem texto) e adição de ícones Lucide nos botões de busca ("Perfil" e "Agenda").

# Código Existente Relacionado

* `src/apps/student/StudentApp.tsx` (fluxo principal do aluno, lista de aulas, gerenciamento de abas, refresh de bookings)
* `src/apps/student/components/BookingDetailsModal.tsx` (detalhes da reserva, CTA "Finalizar pagamento", countdown de hold, ações por status)
* `src/components/ui/BookingCard.tsx` (card de agendamento com exibição de StatusBadge)
* `src/components/ui/StatusBadge.tsx` (badge de status padronizado)
* `src/components/search/ProviderResultCard.tsx` (card de resultado de busca com badges do prestador e botões Perfil/Agenda)
* `src/components/search/ProviderPublicProfileModal.tsx` (modal de perfil público do prestador com badge de verificação)
* `src/components/ui/ProviderCard.tsx` (componente reutilizável de fornecedor)
* `src/apps/design-system/DesignSystemShowcase.tsx` (vitrine de componentes do Design System)

# Arquivos Afetados

* `[MODIFY]` [StudentApp.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
* `[MODIFY]` [BookingDetailsModal.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/student/components/BookingDetailsModal.tsx)
* `[MODIFY]` [BookingCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/BookingCard.tsx)
* `[MODIFY]` [StatusBadge.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/StatusBadge.tsx)
* `[MODIFY]` [ProviderResultCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/search/ProviderResultCard.tsx)
* `[MODIFY]` [ProviderPublicProfileModal.tsx](file:///D:/mazzi_premium_ui_v2/src/components/search/ProviderPublicProfileModal.tsx)
* `[MODIFY]` [ProviderCard.tsx](file:///D:/mazzi_premium_ui_v2/src/components/ui/ProviderCard.tsx)
* `[MODIFY]` [DesignSystemShowcase.tsx](file:///D:/mazzi_premium_ui_v2/src/apps/design-system/DesignSystemShowcase.tsx)
* `[NEW]` `tests/task-009-pending-payment-and-refinements.test.ts`

# Banco de Dados & Migrations Afetadas

* O banco de dados PostgreSQL/Supabase LIVE já possui as tabelas `bookings`, `quotes`, `payments` e as colunas `hold_expires_at` operacionais.
* Nenhuma alteração DDL ou nova migration é necessária nesta task, pois os campos e status de backend (`PENDING_PAYMENT`, `CONFIRMED`, `EXPIRED`, `CANCELLED_BY_STUDENT`, etc.) já existem e são canônicos.

# RLS e RBAC Afetados

* Assegurar que consultas e mutações continuem respeitando `booking.student_id = auth.uid()`.

# Estratégia de Implementação

1. **Retomada de Pagamento Pendente (PARTE A, F, G, H):**
   - Atualizar `BookingDetailsModal.tsx` para verificar se `booking.status === 'PENDING_PAYMENT'`:
     - Se `holdExpiresAt` for válido no futuro (`> Date.now()`), exibir banner discreto com countdown de tempo restante e o botão principal `[ Finalizar pagamento ]` (com ícone `CreditCard`, min-height >= 48px).
     - Se `holdExpiresAt` expirou (`<= Date.now()`), exibir mensagem "Tempo para pagamento expirado", badge "Expirada" e botão "Agendar novamente".
   - Em `StudentApp.tsx`: ao acionar `onContinuePayment(booking)` em um booking em `PENDING_PAYMENT` válido, o aplicativo abre o `CheckoutModal` passando a reserva e o pagamento existentes (sem gerar nova quote ou novo booking).
   - Ao confirmar o pagamento no `FakePaymentGateway`, a reserva transiciona para `CONFIRMED` e o estado local é invalidado imediatamente.

2. **Atualização & Realtime das Aulas (PARTE B):**
   - Em `StudentApp.tsx`:
     - Adicionar invalidação imediata (`setBookingsRefreshKey(prev => prev + 1)`) após o checkout ou confirmação de pagamento.
     - Adicionar o botão de atualização manual (`RefreshCw`) no cabeçalho da aba "Minhas aulas" com touch-target >= 44px.
     - Adicionar listener para `visibilitychange` (ao voltar o foco para a aba do navegador) executando refetch automático.
     - Configurar Supabase Realtime subscription na tabela `bookings` filtrada pelo `user.id`, executando refetch no evento e efetuando cleanup no unmount/logout.

3. **Status nos Cards do Histórico (PARTE C):**
   - Atualizar `StatusBadge.tsx` para usar o rótulo "Pagamento pendente" quando o status for `PENDING_PAYMENT` e `audience="student"`.
   - Atualizar `BookingCard.tsx` para usar `StatusBadge` em todos os estados de agendamento (incluindo `COMPLETED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_PROVIDER`, `EXPIRED`, `CONFIRMED`, `IN_PROGRESS`, `PENDING_PAYMENT`), garantindo apresentação padronizada na aba Histórico e Próximas.

4. **Refino do Verificado do Fornecedor (PARTE D):**
   - Atualizar `ProviderResultCard.tsx`, `ProviderPublicProfileModal.tsx` e `ProviderCard.tsx`: remover o elemento de texto `<span>Verificado</span>` adjacente ao avatar.
   - Manter apenas o ícone `ShieldCheck` com `aria-label="Prestador verificado"` em um badge discreto sobreposto ou adjacente ao avatar.

5. **Ícones nos Botões dos Cards de Busca (PARTE E):**
   - Em `ProviderResultCard.tsx`:
     - Adicionar `leftIcon={<User className="h-4 w-4 shrink-0" aria-hidden="true" />}` no botão "Perfil".
     - Adicionar `leftIcon={<Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />}` no botão "Agenda" / "Agendar".
     - Garantir min-height >= 44px e alinhamento vertical flexbox.

6. **Design System (PARTE I):**
   - Atualizar `DesignSystemShowcase.tsx` para incorporar amostras visuais dos novos componentes e estados: `StatusBadge` com "Pagamento pendente", botão "Finalizar pagamento", badge de verificação icon-only, botões "Perfil" e "Agenda" com ícones Lucide.

7. **Testes & Quality Gates (PARTE J):**
   - Criar `tests/task-009-pending-payment-and-refinements.test.ts`.
   - Executar `npm run lint`, `npm test` e `npm run build:all`.

8. **Versionamento Git (PARTE K):**
   - Fazer commit com mensagem `feat: resume pending payments and improve booking experience`.
   - Executar `git push origin premium_ui_v2`.
   - Garantir que a branch `main` não seja alterada e nenhum deploy seja acionado.

# Instruções para o MAZZI Dev

* Siga o padrão de design MAZZI Premium V2 (`#f7f5ef` background, `#f6c945` amarelo primário, `#202126` escuro, `#e9e6de` bordas).
* Mantenha acessibilidade com `aria-label`, foco visível e touch targets >= 44px (e >= 48px para o CTA principal).
