# Technical Plan — TASK-080

TASK: TASK-080
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-27

## 1. Resumo Técnico

Estender o contrato financeiro atual com um fluxo Pix Mercado Pago server-side: criação de cobrança por Edge Function, recebimento de notificações em Edge Function dedicada, consulta autoritativa ao gateway e finalização por RPC idempotente. O frontend somente inicia, exibe e consulta o estado; não confirma pagamento.

O repasse continuará manual. O banco prepara/atualiza um registro de `payouts` quando a reserva é paga e concluída, e uma RPC administrativa registra a realização manual após validação do destino Pix e da referência.

## 2. Código Existente Relacionado

- `src/apps/student/components/CheckoutModal.tsx`: seleção de gateway/método, Pix fake e checkout Mercado Pago.
- `src/apps/student/components/MercadoPagoCardCheckout.tsx`: padrão de integração com SDK Mercado Pago.
- `src/lib/db-service.ts`: RPCs e invocação de Edge Functions.
- `src/apps/admin/AdminComponents.tsx` / `AdminApp.tsx`: financeiro e repasses.
- `src/apps/provider/ProviderApp.tsx` / `ProviderProfileTab.tsx`: dados de conta do PRO.
- `src/types/index.ts` e `src/lib/database.types.ts`: contratos financeiros.
- `supabase/functions/process-mercadopago-card-payment`: integração de cartão de teste existente.
- RPCs `create_booking_payment`, `confirm_booking_payment` e `mark_booking_payment_failed`.

## 3. Arquivos Afetados

- `[NEW]` `supabase/functions/process-mercadopago-pix-payment/index.ts`
- `[NEW]` `supabase/functions/mercadopago-payment-webhook/index.ts`
- `[NEW]` `src/apps/student/components/MercadoPagoPixCheckout.tsx`
- `[NEW]` `tasks/TASK-080/*`
- `[MODIFY]` `supabase/migrations/<timestamp>_pix_receiving_and_manual_payouts.sql`
- `[MODIFY]` `src/apps/student/components/CheckoutModal.tsx`
- `[MODIFY]` `src/lib/db-service.ts`
- `[MODIFY]` `src/apps/admin/AdminApp.tsx`
- `[MODIFY]` `src/apps/admin/AdminComponents.tsx`
- `[MODIFY]` `src/apps/provider/ProviderApp.tsx` / `ProviderProfileTab.tsx`
- `[MODIFY]` `src/types/index.ts` / `src/lib/database.types.ts`
- `[MODIFY]` `docs/product/MVP_RULES.md`, `docs/product/PRODUCT_DECISIONS.md`, `docs/09-payments.md`, `docs/13-admin.md`

## 4. Banco de Dados & Migrations

- Estender `payments` com dados de Pix/expiração e taxa efetiva do gateway, sem armazenar segredo.
- Criar `provider_pix_destinations` com uma chave ativa por prestador, ownership pelo PRO e acesso de leitura operacional restrito.
- Estender `payouts` com snapshot das taxas, método/destino mascarado, referência manual, ator e motivo de falha.
- Criar índices únicos para `payments.idempotency_key`, `payouts.booking_id` e evento externo do webhook.
- Criar RPCs para salvar/consultar o Pix do próprio PRO, consultar repasses do Admin, preparar repasses elegíveis e concluir repasse manual.
- Criar RPC de finalização Pix que bloqueia pagamento e reserva na mesma transação, rejeita divergências e não rebaixa estados.
- Criar tabela de eventos de webhook idempotentes, caso o schema live ainda não possua uma compatível.
- Aplicar RLS em toda tabela nova e não conceder escrita direta ao frontend.
- Atualizar a RPC de configuração para aceitar somente as chaves financeiras necessárias, com limite de taxa combinada.

## 5. RLS e RBAC Afetados

- PRO só lê/altera o destino Pix vinculado a `providers.user_id = auth.uid()`; escola somente seus próprios prestadores autorizados.
- Admin financeiro usa `current_user_has_permission('admin.finance.read_all')`/permissão de gestão equivalente.
- Webhook usa `service_role` exclusivamente na Edge Function; nenhum segredo ou service role vai para o browser.
- RPCs `SECURITY DEFINER` terão `search_path` fixo, `REVOKE` de `PUBLIC`/`anon` e grants mínimos.
- O webhook valida HMAC e consulta o pagamento usando token de servidor antes de chamar a RPC.

## 6. Estratégia de Implementação

1. Adicionar a migration criada pelo CLI, com enums/colunas, constraints, RPCs, grants, RLS e auditoria.
2. Criar o Edge Function de criação de Pix, validando sessão, pagamento, reserva, valor, ambiente e idempotência.
3. Criar o Edge Function de webhook, validando assinatura, deduplicando evento, consultando o Mercado Pago e finalizando somente status aprovado.
4. Atualizar `db-service` e o CheckoutModal com componente Pix real, polling manual/automático controlado e estados amigáveis.
5. Adicionar cadastro de Pix no PRO e painel de repasses/ação manual no Admin.
6. Atualizar tipos, documentação e testes unitários/estáticos.
7. Aplicar migration no projeto Supabase, verificar schema/RLS/advisors e fazer deploy das Edge Functions.
8. Executar lint, testes e builds dos três apps; auditar manualmente o fluxo fake, o fluxo Pix pendente e os bloqueios de permissão.

## 7. Testes Obrigatórios

- Testes de idempotência na criação/finalização de pagamento e repasse.
- Testes de assinatura inválida, evento duplicado, pagamento divergente e status não aprovado.
- Testes de RLS para PRO/Admin e isolamento entre prestadores.
- Testes de limite de taxa e arredondamento em centavos inteiros.
- Testes de estados `LOADING`, `PENDING`, `SUCCESS`, `ERROR`, `EXPIRED` e `DISABLED`.
- Regressão do gateway fake e cartão Mercado Pago de teste.
- `npm run lint`, `npm test`, `npm run build:all`.

## 8. O que NÃO Alterar

- Não ativar produção do Mercado Pago.
- Não implementar OAuth, split automático ou transferência Pix automática.
- Não confirmar reserva no cliente.
- Não remover o gateway fake.
- Não alterar categorias, regras de disponibilidade, cancelamento ou contratos de aulas fora do fluxo financeiro.

## 9. Instruções para o MAZZI Dev

Use somente centavos inteiros, mensagens em português e componentes MAZZI existentes. Preserve as assinaturas públicas das RPCs atuais. Qualquer erro do gateway deve ser traduzido antes de chegar à interface. Após a implementação, registrar migration aplicada, deploys, testes e limitações em `implementation-report.md`; não declarar a task como concluída antes da auditoria QA.
