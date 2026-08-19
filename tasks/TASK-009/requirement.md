TASK: TASK-009
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-18T21:20:00-03:00

# Objetivo

Implementar a retomada de pagamento de agendamentos pendentes (`PENDING_PAYMENT`), a atualização imediata/em tempo real e manual da lista de aulas do estudante, a inclusão de badges de status visíveis em todos os cards do histórico/agendamentos, a adequação do badge do fornecedor verificado (apenas ícone sem o texto "Verificado") e a adição de ícones de usuário ("Perfil") e calendário ("Agenda") nos cards de busca, alinhando toda a interface aos padrões do MAZZI Premium V2.

# Problema

1. Quando o aluno gera uma reserva (`PENDING_PAYMENT`) e sai da tela de checkout ou fecha o aplicativo, ele não consegue retomar o pagamento existente sem refazer todo o fluxo de busca/agendamento.
2. A lista de agendamentos do aluno não é atualizada imediatamente após a criação da reserva, exigindo reinício do aplicativo.
3. Os cards de histórico e agendamentos não apresentam visualização uniforme de status humano.
4. O badge "Verificado" do fornecedor exibe texto redundante junto ao avatar.
5. Os botões "Perfil" e "Agenda" nos cards de busca não possuem ícones visuais padronizados.

# Usuário Afetado

* `STUDENT` (estudantes agendando e visualizando aulas)
* `INSTRUCTOR` / `SCHOOL_ADMIN` (prestadores afetados pelo ciclo de status da reserva)

# Escopo

1. **Retomada de Pagamento Pendente:**
   - Para reserva `PENDING_PAYMENT` com `hold_expires_at > NOW()`, exibir CTA principal "Finalizar pagamento" na tela/modal de Detalhes da Aula.
   - O clique em "Finalizar pagamento" abre o fluxo de pagamento (FakePaymentGateway) reutilizando a reserva e pagamento já existentes, sem recriar quote ou booking.
   - Caso `hold_expires_at <= NOW()`, exibir "Tempo para pagamento expirado" e botão "Agendar novamente", desabilitando opção de pagamento.
   - Manutenção de idempotência para evitar duplicidade de pagamentos.

2. **Atualização da Lista de Aulas:**
   - Invalidação/atualização imediata da lista de aulas no aplicativo do estudante após `create_booking_hold`.
   - Inclusão de botão manual de atualização (`RefreshCw`) no cabeçalho com min-height/touch-target >= 44px.
   - Atualização automática em evento `visibilitychange` (ao retornar o foco para a janela).
   - Suporte a Supabase Realtime para escutar inserções/atualizações na tabela `bookings` do usuário.

3. **Status nos Cards do Histórico:**
   - Exibição de `StatusBadge` legível em todos os cards (ex: "Pagamento pendente", "Confirmada", "Em andamento", "Concluída", "Cancelada pelo aluno", "Cancelada pelo instrutor", "Expirada").

4. **Refinos do Fornecedor Verificado:**
   - Remoção do texto visual "Verificado" ao lado da foto do instrutor/autoescola, mantendo o ícone `ShieldCheck` em formato badge e adicionando `aria-label="Prestador verificado"`.

5. **Ícones nos Botões dos Cards de Busca:**
   - Botão "Perfil": inclusão do ícone `UserRound` ou `User` do Lucide.
   - Botão "Agenda": inclusão do ícone `CalendarDays` ou `Calendar` do Lucide.
   - Manutenção de alinhamento vertical e touch-target >= 44px.

6. **Design System & Visual Consistency:**
   - Atualização do `DesignSystemShowcase.tsx` com exemplos dos novos estados e botões.
   - Garantia dos tokens Premium V2 (`#f7f5ef` background, `#f6c945` amarelo primário, `#202126` escuro, `#e9e6de` bordas).

7. **Versionamento Git:**
   - PUSH das alterações para `origin/premium_ui_v2`.
   - Manutenção da branch `main` 100% intacta (SEM merge ou push para a main).

# Fora de Escopo

* Ativação de gateways de pagamento reais (Mercado Pago, Pagar.me, etc.) — o `FakePaymentGateway` permanece ativo.
* Publicação dos aplicativos em produção/GitHub Pages.

# Regras de Negócio

* `RN01`: O booking em estado `PENDING_PAYMENT` com hold ativo é a fonte de verdade para a retomada. Quotes consumidas não são recriadas.
* `RN02`: O preço da aula é imutável durante a retomada e deve utilizar os valores persistidos no booking/quote original.
* `RN03`: Um aluno só pode visualizar e retomar pagamentos de reservas de sua própria autoria (`booking.student_id = auth.uid()`).
* `RN04`: Se o tempo do hold expirar (`hold_expires_at <= NOW()`), a reserva deve transicionar para `EXPIRED` e a tentativa de pagamento deve ser bloqueada.

# Critérios de Aceite

* **AC01:** Ao criar um booking `PENDING_PAYMENT` e fechar o modal, a lista de aulas exibe a nova reserva imediatamente sem exigir reinício do app.
* **AC02:** Ao abrir os Detalhes da Aula para uma reserva `PENDING_PAYMENT` válida, o CTA "Finalizar pagamento" é exibido com altura >= 48px e leva direto ao checkout/FakePaymentGateway do booking existente.
* **AC03:** Ao concluir o pagamento no FakePaymentGateway, a reserva passa para `CONFIRMED` e a lista de aulas atualiza automaticamente.
* **AC04:** Se o hold expirar, o botão "Finalizar pagamento" não é exibido, dando lugar à indicação "Pagamento expirado" e à opção "Agendar novamente".
* **AC05:** Todos os cards da aba Histórico exibem o status humano correspondente através do `StatusBadge`.
* **AC06:** O avatar do fornecedor não exibe o texto impresso "Verificado", contendo apenas o badge com o ícone `ShieldCheck` e o atributo `aria-label="Prestador verificado"`.
* **AC07:** Os botões "Perfil" e "Agenda" no card de busca possuem os ícones Lucide correspondentes (`User` e `Calendar`), mantendo alinhamento e touch target >= 44px.
* **AC08:** O `DesignSystemShowcase` é atualizado para exibir todos os novos padrões visuais.
* **AC09:** Lint, testes e build compilam com 100% de sucesso.
* **AC10:** As alterações são commitadas e enviadas via `git push origin premium_ui_v2`, mantendo a branch `main` inalterada.
