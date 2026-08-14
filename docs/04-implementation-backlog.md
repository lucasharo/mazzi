# MAZZI — backlog incremental para Codex

## Regra de execução

Uma tarefa vertical por vez. Antes de codar, confirmar que ela não depende de uma decisão pendente. Atualizar documentação, migração e testes junto à mudança.

| # | Tarefa | Resultado | Dependência |
|---:|---|---|---|
| 0 | Decisões prioritárias | Piloto, oferta, política operacional e pagamento aprovados | Produto/jurídico |
| 1 | Bootstrap da stack definida | Next.js/React/TypeScript, PostgreSQL/Prisma, PWA, CI, env.example, lint/test | Escolher provedores apenas ao chegar às integrações |
| 2 | Identidade/RBAC | Migrações, auth e testes de isolamento | Provedor de auth se externo |
| 3 | Onboarding/admin | Perfis, escola/instrutor, aprovação e auditoria | Documentos aprovados |
| 4 | Catálogo/veículos | Oferta pesquisável; vários veículos | Regra da categoria A |
| 5 | Agenda/hold | Booking atômico e testes concorrentes | Duração/formato |
| 6 | Pagamento sandbox | Checkout e webhook idempotente | Provedor e regras financeiras |
| 7 | Student App | Busca → reserva → confirmação | 2–6 |
| 8 | Provider App | Agenda, perfil, veículos, reservas | 2–5 |
| 9 | Chat/avaliação/suporte | Acesso por reserva e moderação | Retenção/moderação |
| 10 | Admin/piloto | Operação, métricas e checklist | Políticas aprovadas |

## Prompts prontos

**Fundação:** “Leia `AGENTS.md` e `docs/`. Proponha uma stack mínima para o MVP MAZZI e aguarde aprovação antes de criar arquivos. Não implemente funcionalidades fora do MVP.”

**Booking:** “Leia `docs/02-business-rules.md` e `docs/03-engineering-architecture.md`. Implemente somente disponibilidade e booking hold, com migrações e testes concorrentes que provem que instrutor e veículo não podem ter sobreposição. Não inclua pagamento, chat ou jornada da CNH.”

**Pagamento:** “Liste decisões financeiras/credenciais ainda necessárias. Quando fornecidas, implemente apenas checkout e webhook idempotente em sandbox, preservando booking. Não implemente repasses sem regra aprovada.”

**Piloto:** “Revise o MVP contra `docs/01-mvp-product.md` e `docs/02-business-rules.md`. Produza checklist de piloto em São Paulo, sem alterar código.”
