# TASK-088 — Plano técnico da auditoria

Status: TECH_READY  
Responsável: Tech Lead  
Workflow: `/mazzi-feature`  

## Estratégia

1. Confirmar baseline do repositório e os gates existentes.
2. Inventariar as fronteiras de dados dos dois apps: `AuthContext`, `dbService`, componentes de tela, hooks e listeners.
3. Medir requests reais no DEV/local usando a aba Network/Performance do navegador, sem instrumentação permanente no produto.
4. Repetir cenários de navegação e comparar primeira carga, retorno e remount.
5. Classificar cada ocorrência como StrictMode-only, duplicação de produção, refetch necessário ou risco a confirmar.
6. Registrar achados, arquivos afetados e correções em fases; nenhuma correção de código nesta execução.

## Evidência mínima

- URL, app, fluxo, estado inicial e janela de medição;
- método Supabase/RPC/endpoint;
- contagem observada em DEV;
- interpretação para produção;
- arquivo responsável e prioridade.

## Arquivos consultados

- `src/apps/student/StudentApp.tsx`
- `src/apps/provider/ProviderApp.tsx`
- `src/apps/student/components/BookingDetailsModal.tsx`
- `src/apps/provider/components/ProviderEarningsTab.tsx`
- `src/apps/provider/components/ProviderDashboardTab.tsx`
- `src/components/chat/BookingChatPanel.tsx`
- `src/components/booking/BookingDisputePanel.tsx`
- `src/components/notifications/NotificationsPanel.tsx`
- `src/components/ui/NotificationIndicator.tsx`
- `src/lib/db-service.ts`
- `src/components/auth/AuthContext.tsx`
- `src/entrypoints/student/main.tsx`
- `src/entrypoints/instructor/main.tsx`

## Decisões técnicas

- Manter o `dbService` e o cliente Supabase atuais nesta fase.
- Não criar cache global sem antes resolver duplicações confirmadas e definir TTL/invalidação por recurso.
- Não alterar schema nem políticas RLS.
- Manter cleanup de channels e listeners existente; corrigir somente churn ou sobreposição comprovados.
- Cada correção futura deve ter teste de contagem de requests e teste funcional do fluxo afetado.

## Entregáveis

- `requirement.md`: requisito e aceite;
- `technical-plan.md`: plano desta auditoria;
- `performance-audit-report.md`: evidências, priorização e plano de otimização.

## Critério de saída

O relatório precisa permitir iniciar uma fase de otimização sem adivinhar a causa e sem fazer alteração estrutural prematura. Saída: `PERFORMANCE_AUDIT_READY`; próximo status: `READY_FOR_PERFORMANCE_OPTIMIZATION`.
