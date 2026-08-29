# Technical Plan — TASK-082

TASK: TASK-082
STATUS: IMPLEMENTED
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-28

---

## 1. Resumo Técnico
Trocar todos os diálogos nativos do navegador por estados React controlando componentes visuais do MAZZI. O estorno usará um modal contextual; erros e avisos usarão feedback visual apropriado.

## 2. Código Existente Relacionado
- `src/apps/admin/AdminApp.tsx`
- `src/apps/admin/AdminComponents.tsx`
- `src/apps/provider/ProviderApp.tsx`
- `src/lib/db-service.ts`
- `supabase/functions/process-mercadopago-refund/index.ts`

## 3. Arquivos Provavelmente Afetados
- [MODIFY] `src/apps/admin/AdminApp.tsx`
- [MODIFY] `src/apps/admin/AdminComponents.tsx`
- [MODIFY] `src/apps/provider/ProviderApp.tsx`
- [NEW/MODIFY] componente de modal compartilhado, se necessário
- [MODIFY] testes do fluxo financeiro do Admin

## 4. Banco de Dados & Migrations
N/A. A tarefa é exclusivamente de interface e controle da confirmação.

## 5. RLS e RBAC Afetados
Nenhum. A autorização existente do Edge Function deve permanecer obrigatória.

## 6. Estratégia de Implementação
1. Remover o `window.confirm` do handler de estorno.
2. Criar estado para transação selecionada e abertura do modal.
3. Renderizar dados do pagamento e ambiente atual, evitando textos fixos de teste.
4. Encaminhar a confirmação para o handler existente, com proteção contra duplo clique.
5. Substituir os quatro `alert` do PRO por mensagens de feedback do app.
6. Validar teclado, foco, responsividade e estados de erro/processamento.

## 7. Testes Obrigatórios
- [ ] Teste de renderização do modal com transação de produção.
- [ ] Teste de cancelamento sem chamada de estorno.
- [ ] Teste de confirmação chamando o handler uma única vez.
- [ ] Teste de estado de carregamento e prevenção de duplo clique.
- [ ] Teste de regressão do fluxo de estorno.
- [ ] Busca automatizada garantindo ausência de `window.alert`, `window.confirm` e `window.prompt` em `src`.

## 8. Riscos e Mitigações
- **Risco**: dupla solicitação. **Mitigação**: desabilitar confirmação durante processamento e manter idempotência no backend.
- **Risco**: mensagem de ambiente incorreta. **Mitigação**: derivar o texto da configuração efetiva do gateway.

## 9. O que NÃO Alterar
Não alterar a Edge Function, regras de elegibilidade, valores do estorno ou a confirmação financeira no backend.

## 10. Instruções para o MAZZI Dev
Usar o componente de modal padrão, manter o foco acessível e não executar efeitos colaterais durante a abertura ou cancelamento.
