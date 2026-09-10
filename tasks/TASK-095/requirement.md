# TASK-095 — Relatórios em pt-BR com visão diária e desfechos de pagamento

TASK: TASK-095
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-10

## 1. Objetivo

Tornar os relatórios administrativos legíveis em pt-BR e acrescentar tabelas diárias no período selecionado, distinguindo cancelamentos ocorridos após pagamento de desistências de pagamento.

## 2. Problema

Os relatórios ainda exibem status e eventos técnicos em inglês e não permitem acompanhar a evolução dia a dia nem separar os dois desfechos financeiros solicitados pelo Admin.

## 3. Usuário Afetado

Administrador da plataforma (`PLATFORM_ADMIN`).

## 4. Escopo

- Traduzir títulos, métricas, status, papéis, eventos e motivos visíveis nos dez relatórios para pt-BR.
- Exibir uma tabela diária dentro de cada um dos dez relatórios, com colunas pertinentes ao domínio e todos os dias do período selecionado.
- Exibir métricas destacadas de cancelamentos após pagamento e desistências de pagamento.
- Definir cancelamento após pagamento como reserva cancelada com pagamento `PAID` associado.
- Definir desistência de pagamento como tentativa `FAILED`, `CANCELLED` ou `EXPIRED` sem qualquer pagamento `PAID` para a mesma reserva.
- Manter os filtros de datas, seleção de relatórios e exportação para PDF.

## 5. Fora de Escopo

- Alterar estados de reservas ou pagamentos.
- Inferir desistência quando não existir tentativa de pagamento registrada.
- Expor PII, conteúdo de mensagens, dados de cartão, tokens ou caminhos de Storage.
- Criar novos domínios de relatório além dos dez já disponíveis.

## 6. Regras de Negócio

- Datas da tabela diária usam `America/Sao_Paulo` e incluem todos os dias do intervalo selecionado, inclusive dias sem registros.
- O intervalo continua limitado a 366 dias e permanece validado no backend.
- Cancelamentos após pagamento são contados por reserva, sem duplicação por múltiplas tentativas de pagamento.
- Desistências são contadas por tentativa não paga, sem incluir reservas que tiveram qualquer pagamento pago.
- Valores financeiros continuam em centavos inteiros no contrato e são formatados como BRL somente na interface.
- A autorização da nova consulta é a mesma dos relatórios existentes: usuário autenticado, ativo e `PLATFORM_ADMIN`.

## 7. Fluxo Principal (Happy Path)

1. O Admin escolhe o intervalo.
2. O sistema carrega os dez relatórios existentes e a evolução diária.
3. O Admin vê os textos traduzidos, a tabela por dia e os cartões de desfecho de pagamento.
4. O Admin seleciona os relatórios desejados e salva a visão em PDF.

## 8. Casos de Borda e Exceções

- Período sem movimentação: exibir linhas diárias zeradas e estado vazio amigável.
- Reserva com vários pagamentos: contar uma vez como cancelamento pós-pagamento se existir ao menos um `PAID`.
- Tentativa falha seguida de pagamento pago: não contar como desistência.
- Status ou evento futuro desconhecido: exibir fallback pt-BR sem quebrar a tabela.
- Falha na consulta diária: preservar a visão principal e exibir erro acionável.

## 9. Estados de Erro e Mensagens

- `Não foi possível carregar a evolução diária agora. Tente novamente.`
- `Não há movimentações no período selecionado.`
- Status/evento desconhecido: `Não informado`.

## 10. Critérios de Aceite

- **AC01**: Nenhum status, papel, evento, motivo ou título técnico dos relatórios é exibido em inglês quando houver tradução definida.
- **AC02**: O Admin visualiza uma tabela diária dentro de cada relatório selecionado, com uma linha para cada dia do período, inclusive dias sem registros.
- **AC03**: As tabelas diárias usam colunas pertinentes a cada domínio e cobrem reservas, pagamentos, volume, reembolsos, repasses, oferta, demanda, usuários, compliance, cancelamentos e comunicações em pt-BR.
- **AC04**: Cancelamentos após pagamento e desistências de pagamento aparecem em métricas separadas, sem dupla contagem.
- **AC05**: O backend mantém autenticação, RBAC, limite de 366 dias e ausência de PII.
- **AC06**: A seleção dos relatórios e o PDF continuam funcionando com a nova seção diária.
- **AC07**: Valores financeiros seguem em centavos no RPC e são apresentados em BRL na UI.
- **AC08**: A tabela é utilizável em telas pequenas com rolagem horizontal somente dentro da tabela, sem overflow da página.

## 11. Dependências

- TASK-094 e RPC `get_admin_reports` já aplicadas no Supabase DEV.
- Tabelas existentes de bookings, payments, refunds, payouts, users, compliance, notifications e email_deliveries.
- Design System MAZZI e `AdminReportsPanel`.

## 12. Decisões Pendentes

Nenhuma. As definições de desfecho estão fixadas nesta tarefa.

## 13. Riscos de Produto

- Dados históricos sem tentativa de pagamento não permitem identificar desistência; esses casos devem permanecer zerados, sem inferência.
- A tabela diária pode ficar larga em celulares; o contêiner interno deve permitir leitura sem quebrar o layout.

## 14. Handoff para Tech Lead

Criar uma RPC administrativa forward-only para a série diária, reutilizando as mesmas validações de `get_admin_reports`. Implementar traduções determinísticas no frontend, sem alterar os dez relatórios nem expor dados sensíveis.
