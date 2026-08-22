# 13 — Painel MAZZI Admin (Backoffice & Marketplace)

## Padrão visual Premium UI V2

O Admin usa os mesmos tokens, botões, formulários, estados vazios e tipografia dos apps Aluno e PRO. A tela de Perfil segue a composição compartilhada com avatar central, identificação, card de dados e edição no topo direito. A navegação permanece em sidebar por ser uma superfície web de backoffice.

## Módulos do Painel Administrativo

### Escopo do Admin MVP

O Admin MVP é uma superfície exclusiva de `PLATFORM_ADMIN`. Usuários `SUPPORT` continuam existindo no modelo RBAC, mas recebem `AccessDenied` neste painel; um Support Console específico fica fora desta versão.

As leituras administrativas falham de forma explícita e não são convertidas em listas vazias. A fila de compliance usa projeção mínima e não exibe caminhos internos de storage; o bucket permanece privado.

### 1. Dashboard Executivo & Marketplace Liquidity
- **North Star Metric:** Aulas práticas concluídas na semana.
- **Liquidez:** Taxa de conversão *Search-to-Booking*.
- **Métricas:** GMV total, receita de comissão da MAZZI, volume de buscas sem resultado por bairro/região em SP.
- **Gráficos de Oferta x Demanda:** Comparativo de slots disponíveis vs reservas efetuadas.

### 2. Operações & Cadastros
- **Gestão de Usuários e Fornecedores:** Busca, bloqueio preventivo, alteração de status.
- **Fila de Compliance:** Análise de CNH, CRLV, alvarás com visualizador seguro e aprovação/rejeição com justificativa obrigatória.
- **Gestão de Reservas (Bookings):** Resolução de disputas, cancelamento administrativo, visualização de logs de presença e chat moderado.

O fluxo de revisão também atende documentos globais do instrutor e documentos vinculados ao contexto da autoescola por RPC segura, sem expor caminhos de storage ou dados sensíveis na UI.
- **Financeiro & Payouts:** Visualização de pagamentos, comissões retidas, liberação ou bloqueio de repasses a fornecedores.

### 3. Configurações & Auditoria
- Configuração global da taxa de comissão (`platform_fee_percentage`).
- Configuração do tempo de expiração de Quotes (padrão: 10 minutos).
- Trilha de Auditoria (`AuditLog`): Histórico cronológico detalhado com ator, ação, entidade, valores anteriores e novos; a leitura Admin retorna somente as colunas operacionais aprovadas.

Pagamentos continuam `FAKE / MOCK_VALIDATION`. Disputas, reassignment e operações reais de payout permanecem deferidos.
