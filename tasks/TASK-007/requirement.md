# TASK-007 — REVISÃO COMPLETA DE CANCELAMENTO + CHAT + SLOT RELEASE + NOVA COTAÇÃO + OTP 8 DÍGITOS + REFINAMENTO VISUAL

- **TASK**: TASK-007
- **STATUS**: PRODUCT_READY
- **OWNER**: MAZZI Product
- **LAST_UPDATED**: 2026-08-18

---

# 1. Objetivo

Fazer a revisão e correção definitiva dos fluxos de:
1. Cancelamento de aula (Aluno e Prestador) com modais dedicados e preservação de DEC-013.
2. Liberação imediata do horário cancelado no banco de dados e estado do cliente.
3. Possibilidade de remarcar/realizar nova reserva do MESMO horário cancelado sem erro de "Cotação expirou".
4. Correção do ciclo de vida de cotações (`quotes`): uma nova tentativa de checkout deve gerar uma nova cotação e chave de idempotência por tentativa, sem reutilizar cotações históricas `CONSUMED` ou `EXPIRED`.
5. Desbloqueio de horários presos por retenções temporárias de pagamento (`PENDING_PAYMENT`) cuja expiração (`hold_expires_at`) já venceu.
6. Ajuste nos modais de cancelamento e detalhes com remoção de containers de ação brancos sólidos (footers transparentes e botões com sensação de "flutuante").
7. Redesenho do Chat com suporte a navegação contextual `← Voltar` (preservando o modal de Detalhes da Aula como origem) e modo Read-Only para aulas canceladas.
8. Atualização do código OTP de autenticação para exatamente 8 dígitos (padrão Supabase/Brevo).

---

# 2. Problema

1. **Bug da cotação expirada ao remarcar o mesmo horário**:
   - `CheckoutModal.tsx` gerava a chave de idempotência de forma determinística por slot: `idem_quote_${offering.id}_${scheduledStartAt}`.
   - Quando uma aula era reservada (quote vira `CONSUMED`), confirmada e posteriormente cancelada, o aluno tentava reservar o mesmo slot.
   - O backend `create_quote_from_offering` buscava a quote por idempotency key e retornava a quote histórica `CONSUMED`/`EXPIRED`.
   - O frontend recebia a quote consumida/expirada e exibia "Cotação expirou", impedindo o novo agendamento.
2. **OTP de 8 Dígitos**:
   - O Supabase envia códigos OTP de 8 dígitos via e-mail Brevo, mas o frontend aceitava e validava apenas 6 dígitos (`length === 6`).
3. **Cancelamento pelo Prestador**:
   - Utilizava `window.confirm` sem modal formal e sem seleção obrigatória do código de motivo (`reasonCode`), impedindo a justificativa textual obrigatória para "Outro motivo" (`OTHER`).
4. **Layout de Modais e Action Footers**:
   - Diversos modais exibiam um bloco/faixa branca pesada atrás dos botões no rodapé.
5. **Navegação do Chat**:
   - Ao abrir o Chat a partir de Detalhes da Aula, o fechamento descarta o estado do modal de origem, impedindo o retorno contextual.
6. **Slots presos por PENDING_PAYMENT expirados**:
   - `is_offering_slot_available` considerava qualquer booking `PENDING_PAYMENT` como bloqueador, mesmo com `hold_expires_at <= now()`.

---

# 3. Usuários Afetados

- **STUDENT**: Alunos reservando, cancelando, remarcando e interagindo no chat da aula.
- **INSTRUCTOR / SCHOOL_ADMIN / DRIVING_SCHOOL**: Prestadores cancelando com justificativa obrigatória e utilizando o chat.
- **PLATFORM_ADMIN**: Auditabilidade e integridade da agenda.

---

# 4. Regras de Negócio Mandatórias

1. **Políticas de Reembolso DEC-013**:
   - Aluno: `>= 24h` = 100%; `>= 6h` e `< 24h` = 50%; `< 6h` = 0%. Motivo opcional.
   - Prestador: 100% de reembolso ao aluno em qualquer momento. Motivo OBRIGATÓRIO (`VEHICLE_ISSUE`, `PERSONAL_EMERGENCY`, `SCHEDULE_CONFLICT`, `WEATHER_OR_SAFETY`, `OPERATIONAL_ISSUE`, `OTHER`). Se `OTHER`, texto descritivo obrigatório.
2. **Ciclo de Vida de Cotações (Quotes)**:
   - Quotes são históricas e imutáveis em seu encerramento (`CONSUMED`, `EXPIRED`).
   - Idempotência deve proteger as chamadas de uma MESMA tentativa de checkout (`attemptId`), e NÃO travar o slot permanentemente.
   - Ao iniciar um novo checkout (ou remarcar slot cancelado), gera-se uma nova tentativa e nova chave de idempotência, criando uma nova quote `ACTIVE` com novo UUID e novo `expires_at`.
   - Se uma cotação expirar durante o checkout com o slot ainda disponível, a UI deve permitir gerar uma nova cotação sem expulsar o aluno da navegação.
3. **Desbloqueio de Horários**:
   - Booking `CANCELLED` libera o horário imediatamente.
   - Booking `PENDING_PAYMENT` com `hold_expires_at <= now()` é varrida atomicamente como `EXPIRED` e libera o horário.
4. **OTP de Autenticação**:
   - Tamanho único de verdade: `AUTH_OTP_LENGTH = 8`.
   - Sanitização numérica e colagem de 8 dígitos.
   - Mensagem anti-enumeração preservada.
5. **Chat**:
   - `← Voltar` retorna para Detalhes da Aula se veio de Detalhes; retorna para Lista se veio da Lista.
   - Aula cancelada deixa o chat em modo `READ-ONLY` preservando todo o histórico.

---

# 5. Critérios de Aceite (AC)

- **AC01 (OTP 8 Dígitos)**: Todos os campos de OTP (`OtpInput`, signup, recovery) aceitam 8 dígitos numéricos e validam corretamente no Supabase.
- **AC02 (Refatoração de Cancelamento Aluno)**: Modal de cancelamento do Aluno exibe prévia transparente do reembolso DEC-013, motivo opcional e botões flutuantes.
- **AC03 (Modal de Cancelamento Prestador)**: Modal formal de cancelamento do Prestador com seleção obrigatória do código de motivo (`reasonCode`) e obrigatoriedade de texto para `OTHER`.
- **AC04 (Action Footers Transparentes & Botões Flutuantes)**: Remoção do bloco branco dos footers de modais. Botões principais com efeito flutuante (sombra sutil, `rounded-2xl`). Botão destrutivo ("Cancelar aula") em vermelho elegante.
- **AC05 (Chat Layout & Voltar Contextual)**: Chat com header refinado, status da aula e botão `← Voltar` que restaura a aula no modal de Detalhes se esta foi a origem.
- **AC06 (Chat Read-Only)**: Aulas canceladas exibem aviso claro e desabilitam o composer no Chat sem deletar mensagens.
- **AC07 (Slot Release Pós Cancelamento)**: Cancelamento libera o slot no banco e no estado do cliente sem exigir F5.
- **AC08 (Nova Cotação ao Remarcar Slot Cancelado)**: Selecionar o mesmo horário cancelado cria uma NOVA quote `ACTIVE` com nova idempotency key por tentativa, sem retornar quote consumida/expirada ou erro "Cotação expirou".
- **AC09 (Hold Expirado Desbloqueia Slot)**: Holds `PENDING_PAYMENT` vencidos são limpos atomicamente e não causam `exclusion_violation` nem indisponibilidade.
- **AC10 (Double-Booking Protection)**: Exclusion constraints e validações atômicas continuam impedindo 100% de agendamentos duplos para reservas ativas.
- **AC11 (Quality Gates)**: `npm run lint`, `npm test` e `npm run build:all` executados com 0 erros.

---

# 6. Handoff para Tech Lead

Encaminhado para o MAZZI Tech Lead para detalhamento técnico.
