# 13 — Painel MAZZI Admin (Backoffice & Marketplace)

## Módulos do Painel Administrativo

### 1. Dashboard Executivo & Marketplace Liquidity
- **North Star Metric:** Aulas práticas concluídas na semana.
- **Liquidez:** Taxa de conversão *Search-to-Booking*.
- **Métricas:** GMV total, receita de comissão da MAZZI, volume de buscas sem resultado por bairro/região em SP.
- **Gráficos de Oferta x Demanda:** Comparativo de slots disponíveis vs reservas efetuadas.

### 2. Operações & Cadastros
- **Gestão de Usuários e Fornecedores:** Busca, bloqueio preventivo, alteração de status.
- **Fila de Compliance:** Análise de CNH, CRLV, alvarás com visualizador seguro e aprovação/rejeição com justificativa obrigatória.
- **Gestão de Reservas (Bookings):** Resolução de disputas, cancelamento administrativo, visualização de logs de presença e chat moderado.
- **Financeiro & Payouts:** Visualização de pagamentos, comissões retidas, liberação ou bloqueio de repasses a fornecedores.

### 3. Configurações & Auditoria
- Configuração global da taxa de comissão (`platform_fee_percentage`).
- Configuração do tempo de expiração de Quotes (padrão: 10 minutos).
- Trilha de Auditoria (`AuditLog`): Histórico cronológico detalhado com ator, ação, entidade, valores anteriores e novos, IP e User-Agent.
