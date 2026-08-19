TASK: TASK-009 (Ajuste Checkout Modais & Classificação Temporal do Histórico)
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-18T21:46:00-03:00

# Objetivo

1. Redesenhar os modais de checkout ("Confirmar sua aula" e "Confirmar pagamento") garantindo conformidade absoluta com o MAZZI Premium V2 (Design System, hierarquia tipográfica, microcopy humana, resumo financeiro claro, ponto de encontro acessível, banners de aviso secundários e footer flutuante).
2. Implementar a regra de classificação temporal estrita para a aba "Histórico" de agendamentos do estudante: qualquer aula cujo `scheduled_end_at <= NOW()` deve obrigatoriamente ir para o Histórico, independentemente de seu status no banco ser `CONFIRMED`, `IN_PROGRESS` ou `PENDING_PAYMENT`.
3. Garantir a transição automática da aula das Próximas para o Histórico no exato momento em que o horário da aula termina (`scheduled_end_at`), sem exigir reinício ou recarga manual do aplicativo.

# Problema

1. Os modais de checkout apresentavam sinais de inconsistência visual (hierarquia de títulos, microcopy técnica como "cotação válida por", resumo de preço e banners de testes muito pesados).
2. Aulas cujo horário já terminou permaneciam na aba de "Próximas aulas" se o status no banco ainda estivesse como `CONFIRMED` ou `IN_PROGRESS`.

# Usuário Afetado

* `STUDENT` (estudantes agendando e visualizando suas aulas)

# Escopo

1. **Redesign do Modal "Confirmar sua aula" (Quote Preview):**
   - Hierarquia visual limpa com fundo `#f7f5ef`, títulos claros, labels secundários discretos e resumo financeiro estruturado.
   - Microcopy amigável ("Este valor fica reservado por mais", "Valor da aula", "Taxa de serviço", "Total").
   - Resumo da aula facilmente escaneável (prestador, instrutor, data, horário, duração, veículo, câmbio, ponto de encontro).
   - Seletor de ponto de encontro acessível (touch target >= 44px, estado selecionado evidente).
   - Footer com ações flutuantes e CTA principal `[ Continuar para pagamento ]` ou `[ Reservar horário ]` com min-height >= 48px.

2. **Redesign do Modal "Confirmar pagamento" (Payment Selection):**
   - Banner "Ambiente de Testes" secundário e não intrusivo.
   - Seletor de forma de pagamento (PIX / Cartão) com touch target >= 44px.
   - CTA principal `[ Confirmar pagamento ]` / `[ Finalizar pagamento ]` com min-height >= 48px e proteção contra duplo clique.
   - Feedback de erro humanizado.

3. **Regra de Classificação Temporal do Histórico:**
   - A aba "Próximas aulas" exibe **estritamente** agendamentos em que `scheduled_end_at > NOW()` (e status é `CONFIRMED`, `IN_PROGRESS`, ou `PENDING_PAYMENT` com hold ativo e futuro).
   - A aba "Histórico" exibe **qualquer** agendamento cujo `scheduled_end_at <= NOW()`, além de agendamentos em estados terminais (`COMPLETED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_PROVIDER`, `EXPIRED`, `NO_SHOW`, `REFUNDED`).
   - O status do objeto não é alterado de forma ilegítima no frontend; a classificação é puramente temporal e conceitual.
   - Em aulas passadas, ações de agendamento ativo (cancelar, pagar) são ocultadas e apenas ações históricas (ver chat, avaliar) são exibidas.

4. **Transição Automática sem Restart:**
   - Agendamento de timer no frontend para o próximo `scheduled_end_at` relevante, reclassificando o agendamento em tempo real assim que o horário é atingido.

5. **Design System & Testes:**
   - Atualização do `DesignSystemShowcase.tsx` com amostragem dos novos modais, cards futuros vs passados e status temporais.
   - Cobertura de testes unitários para a classificação temporal (Cenários A a H) e virada de tempo sem restart.

# Critérios de Aceite

* **AC01:** Modal "Confirmar sua aula" redesenhado conforme o Design System Premium V2.
* **AC02:** Modal "Confirmar pagamento" redesenhado com banner de teste secundário e seletor acessível.
* **AC03:** Aulas com `scheduled_end_at <= NOW()` são exibidas na aba Histórico, mesmo com status `CONFIRMED` ou `IN_PROGRESS`.
* **AC04:** A virada de horário de uma aula em andamento/futura move o card para o Histórico em tempo real sem restart do app.
* **AC05:** Detalhes de aulas no Histórico ocultam o botão de cancelamento ou pagamento.
* **AC06:** `DesignSystemShowcase.tsx` atualizado.
* **AC07:** 100% de aprovação nos testes (`npm test`), linter (`npm run lint`) e build (`npm run build:all`).
