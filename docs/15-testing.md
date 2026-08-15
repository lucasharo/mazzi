# 15 — Estratégia e Pirâmide de Testes

## Níveis de Teste

### 1. Testes Unitários
- Cálculos financeiros imutáveis em centavos (`money.ts`).
- Validação de regras de concorrência e sobreposição de horários (`availability.ts`).
- Matriz de cálculo de multas e reembolsos da política de cancelamento (`cancellation.ts`).
- Resolução de permissões na matriz RBAC (`rbac.ts`).

### 2. Testes de Integração
- **Cenário Crítico de Double Booking:** Simulação de 2 alunos requisitando simultaneamente a reserva do mesmo veículo/instrutor no mesmo slot de tempo -> Exatamente 1 reserva confirmada, a outra rejeitada com conflito 409.
- **Idempotência de Pagamento:** Envio duplicado do mesmo webhook de pagamento -> O processamento financeiro e transição do booking ocorrem exatamente uma vez.
- **Idempotência de Reembolso:** Tentativa de múltiplos refunds sobre a mesma transação -> Ocorre apenas 1 estorno.

### 3. Testes de Segurança (Negative Tests & IDOR)
- Tentativa de Aluno A consultar reservas de Aluno B -> HTTP 403 Forbidden.
- Tentativa de Autoescola A alterar veículo ou agenda de Autoescola B -> HTTP 403 Forbidden.
- Tentativa de secretária (`SCHOOL_STAFF`) acessar endpoints de Payout bancário -> HTTP 403 Forbidden.
