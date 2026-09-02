# 25 — Ganhos e desempenho do PRO

## Contrato financeiro

`Ganhos` usa exclusivamente a RPC `public.get_provider_earnings_summary` e a tabela canônica `public.payouts`. O frontend não calcula comissão, tarifa ou saldo a partir de pagamentos do aluno.

Os valores retornados são centavos inteiros:

- `net_earned_cents`: ganho líquido do payout associado a uma aula economicamente válida;
- `received_cents`: payouts `PAID`, considerados recebidos pelo timestamp de repasse;
- `to_receive_cents`: payouts `PENDING`, `AVAILABLE` ou `PROCESSING`;
- `blocked_cents`: payouts `BLOCKED`, exibidos separadamente;
- `failed_cents`: payouts `FAILED`, exibidos como situação que requer atenção.

Canceladas e reservas reembolsadas não entram no universo financeiro. A data econômica é `completed_at`, com fallback para `lesson_finished_at`, `scheduled_end_at` e, por último, a criação do payout. O fuso de referência é `America/Sao_Paulo`. A comparação usa o período imediatamente anterior com a mesma duração.

Próximos repasses são agrupados pelo `scheduled_release_at` nos sete dias seguintes. Payouts bloqueados nunca são apresentados como data prometida.

## Autorização

A RPC deriva os prestadores autorizados da sessão autenticada:

- `INSTRUCTOR`: próprio provider e permissão `provider.finance.read_own`;
- `DRIVING_SCHOOL`: escola própria ou vínculo ativo e permissão `school.finance.read`.

Não existe `provider_id` fornecido pelo frontend para ampliar escopo. A tabela `payouts` continua sem leitura direta por cliente.

## Navegação e perfil

A bottom navigation do PRO é: `Início`, `Agenda`, `Aulas`, `Ganhos` e `Gestão`. `Perfil` continua disponível pelo ícone de conta do cabeçalho e mantém visualização, edição, foto, salvamento e saída. O contrato completo de destino das notificações está em [`docs/26-pro-earnings-notification-navigation.md`](26-pro-earnings-notification-navigation.md).

## Avaliações e insights

As avaliações são lidas de `reviews`. A nota geral e as dimensões reais são mostradas sem nota fictícia. Insights detalhados só desbloqueiam quando `COUNT(DISTINCT student_id) >= 30`; com menos alunos a tela mostra o progresso. A interpretação é determinística e local, sem LLM ou resumo gerado por IA.
