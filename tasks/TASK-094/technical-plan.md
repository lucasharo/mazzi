# TASK-094 — Plano técnico de relatórios administrativos

TASK: TASK-094  
STATUS: TECH_READY  
OWNER: MAZZI Tech Lead  
LAST_UPDATED: 2026-09-09

## 1. Arquitetura proposta

Adicionar uma RPC administrativa agregadora `public.get_admin_reports(timestamptz, timestamptz)` em migration forward-only. A RPC valida sessão ativa, `is_platform_admin()`, período não nulo, ordem das datas e limite de 366 dias. O frontend chama somente a RPC; não haverá SELECT direto de tabelas protegidas.

O contrato retornará:

```text
{
  period: { from, to, timezone },
  generated_at,
  reports: {
    executive, bookings, revenue, payouts, supply,
    demand, users, compliance, cancellations, communications
  }
}
```

Cada relatório será composto por `summary` (métricas escalares) e `rows` (agregações seguras para tabela), usando texto de status/evento e valores financeiros em centavos.

## 2. Migration e banco

Arquivos: `supabase/migrations/20260910001206_admin_reports.sql` e `supabase/migrations/20260910001920_fix_admin_reports_payment_alias.sql`.

- Criar índices parciais/compostos apenas onde o plano real justificar; priorizar os índices existentes em `created_at`, status e chaves de relacionamento.
- Criar a função em `LANGUAGE plpgsql SECURITY DEFINER`, com `SET search_path = public, pg_temp`.
- Rejeitar `auth.uid() IS NULL`, usuário inativo e qualquer usuário que não seja `PLATFORM_ADMIN`.
- Revogar execução de `PUBLIC`/`anon` e conceder somente a `authenticated`.
- Consultar somente colunas agregadas de `users`, `providers`, `vehicles`, `service_offerings`, `bookings`, `payments`, `payouts`, `quotes`, `reviews`, `analytics_events`, `compliance_documents`, `booking_disputes`, `notifications` e `email_deliveries`.
- Não retornar CPF, nascimento, e-mail, telefone, endereço, storage path, conteúdo de mensagens/e-mails ou identificadores privados.

## 3. Contrato de dados dos dez relatórios

1. `executive`: reservas, concluídas, GMV, comissão, reembolsos e taxas de conversão.
2. `bookings`: `by_status`, `by_source`, `by_category`, `by_transmission`.
3. `revenue`: contagem/volume por status, incluindo taxas e pagamentos falhos.
4. `payouts`: contagem/volume por status e previsão de liberação.
5. `supply`: prestadores, veículos, ofertas ativas e distribuição por categoria/transmissão.
6. `demand`: eventos de busca, perfil, slots, checkout e busca sem resultado quando os eventos possuírem essa propriedade.
7. `users`: novos usuários por papel/status e base ativa.
8. `compliance`: documentos por status/tipo, expirados e a vencer em 30 dias.
9. `cancellations`: reservas canceladas por ator/status, reembolso e contestações por status/resolução.
10. `communications`: notificações por volume/leitura e e-mails por evento/status.

## 4. Frontend

- Criar `src/components/admin/AdminReportsPanel.tsx` com o padrão visual do Admin/Aluno.
- Adicionar rota `reports` ao `AdminApp`, navegação lateral e skeleton analítico.
- Usar `Input` para datas, `Button`/`ButtonBase` para ações e controles com targets mínimos de 44px.
- Presets: 7, 30, 90 e intervalo personalizado; datas armazenadas como `YYYY-MM-DD` e convertidas para limites do dia no timezone operacional.
- Seletor “Relatórios visíveis” com dez opções e `aria-pressed`; a seleção é local à tela e controla a impressão.
- Renderizar cada relatório com título, resumo e tabela responsiva; estado vazio/erro por relatório sem falhar a página inteira.
- Implementar exportação via janela/área de impressão com `@media print`, removendo navegação, filtros e botões; botão rotulado “Baixar PDF”.
- Usar `document.title` temporário e `window.print()`; restaurar o título depois, sem dependência nova.

## 5. Domínio e tipos

Adicionar em `src/types/index.ts` tipos explícitos para período, linha de relatório, métricas monetárias e `AdminReportsResponse`. A normalização numérica ficará em `db-service`; a UI não recalculará somas.

Adicionar em `db-service.ts`:

```ts
getAdminReports(dateFrom: string, dateTo: string): Promise<AdminReportsResponse>
```

O método traduzirá erros conhecidos de período/permissão para os códigos existentes e converterá contagens/centavos numéricos retornados pelo PostgREST.

## 6. Segurança e privacidade

- RPC é a única fronteira de leitura; `SECURITY DEFINER` usa `search_path` fixo.
- Admin `SUPPORT` não recebe acesso porque a autorização é `is_platform_admin()`.
- PDF é gerado no navegador com dados já filtrados pelo backend; não há upload nem armazenamento do arquivo.
- Testes devem cobrir chamada anônima, usuário comum, `SUPPORT`, datas inválidas, limite de 366 dias, ausência de dados e ausência de campos sensíveis.

## 7. Testes e validação

- Teste de contrato da RPC/migration para os dez nós do JSON e tipos de período.
- Teste de componente para filtros, seleção de relatórios, estados de loading/error/empty e impressão.
- Teste de acessibilidade para labels, `aria-pressed`, `role=alert`, teclado e alvos.
- Rodar `npm run lint`, `npm test`, `npm run build:all`.
- Aplicar migration no Supabase DEV com a ferramenta oficial, conferir ledger remoto e executar consulta autenticada de smoke test; produção permanece intocada.

O conector do Supabase atribuiu os timestamps `20260910001206` e `20260910001920` no ledger remoto; os nomes locais foram alinhados a esses registros após a aplicação.

## 8. Riscos e mitigação

- Tabelas opcionais podem não existir em instalações históricas: a migration alvo é o DEV já reconciliado; validar objetos no DEV antes da aplicação.
- Volume alto de eventos: agregações por índice e limite de período.
- Estados novos: usar `status::text` e fallback `Não informado` para preservar leitura sem expor erro técnico.

## 9. Handoff para Dev

Implementar o contrato primeiro, gerar tipos e serviço, depois montar a tela. Não adicionar acesso direto a tabelas, não incluir PII no JSON e não alterar migrations anteriores. Registrar no implementation report os nomes das queries e o smoke test executado no DEV.
