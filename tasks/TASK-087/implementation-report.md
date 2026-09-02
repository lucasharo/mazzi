# Implementation Report — TASK-087

TASK: TASK-087  
STATUS: READY_FOR_QA  
OWNER: MAZZI Dev  
LAST_UPDATED: 2026-09-02

## 1. O que foi Implementado

- Integração cliente com Firebase Cloud Messaging Web usando o SDK modular `firebase@12.18.0`.
- Uso da única `ServiceWorkerRegistration` do MAZZI para obtenção do token FCM; nenhum segundo worker foi criado.
- Normalização e validação do payload FCM data-only contra o resolvedor de navegação compartilhado, sem aceitar URL arbitrária ou conteúdo privado.
- CTA explícito “Ativar notificações”, sem solicitação automática de permissão na inicialização.
- Estados de suporte, permissão negada, configuração ausente, carregamento, sucesso e erro sem bloquear o uso do aplicativo.
- Registro do dispositivo no MAZZI com `provider=FCM`, contexto `STUDENT`/`PRO`, fingerprint local não identificável e suporte a múltiplos contextos/dispositivos.
- Desativação best-effort do dispositivo no logout do Aluno e do PRO.
- Atualização do indicador de notificações quando uma mensagem FCM chega em foreground.
- Configuração pública documentada no `.env.example`, sem valores reais ou credenciais privadas.

## 2. Arquivos Criados ou Alterados

- `.env.example`
- `package.json`
- `package-lock.json`
- `public/sw.js`
- `src/lib/firebase-messaging.ts`
- `src/lib/push-device-registry.ts`
- `src/registerServiceWorker.ts`
- `src/components/notifications/PushNotificationOptIn.tsx`
- `src/components/notifications/NotificationsPanel.tsx`
- `src/apps/student/StudentApp.tsx`
- `src/apps/provider/ProviderApp.tsx`
- `src/entrypoints/student/StudentRoot.tsx`
- `src/entrypoints/instructor/InstructorRoot.tsx`
- `tests/firebase-messaging.test.ts`

Esta lista representa somente a fatia cliente FCM autorizada. Mudanças existentes em `supabase/**`, `.github/workflows/**`, `docs/**`, `tasks/TASK-086/**` e anexos do workspace não foram modificadas nem atribuídas a esta entrega.

## 3. Infraestrutura DEV Criada e Aplicada

- Migration TASK-086 de base de notificações/dispositivos aplicada no Supabase DEV.
- Migration `20260902153159_task_087_fcm_dispatch.sql` aplicada no Supabase DEV, criando ledger privado de entregas, fan-out idempotente, claim com lock e retry limitado.
- Migration `20260902154300_task_087_fcm_webhook_dispatch.sql` versionada no repositório e aplicada no Supabase DEV, conectando `notifications` ao dispatcher via `pg_net` e secret no Vault.
- Edge Function `dispatch-push-notification` publicada no Supabase DEV com `verify_jwt=false` e autenticação por header secreto próprio.
- Secrets server-side DEV configurados: credencial Firebase codificada, projeto Firebase esperado e segredo do webhook. Nenhuma credencial privada foi versionada.
- O projeto Firebase usado é `mazzi-af65c`; nenhuma alteração foi feita em Production.

## 4. Decisões Técnicas Tomadas

- O Firebase é usado apenas como transporte de push; o histórico, a autorização e o destino continuam sob responsabilidade do MAZZI/Supabase.
- A configuração só é considerada pronta quando todos os campos públicos Firebase e a chave VAPID pública estão presentes.
- O token FCM é passado ao RPC existente como endpoint privado do device; o token não é exibido, logado ou incluído no payload de navegação.
- A permissão do navegador só é solicitada dentro da ação explícita do usuário.
- O worker aceita o envelope FCM e converte campos string para o contrato allowlisted, mantendo os textos exibidos genéricos.
- Falhas de configuração, suporte, permissão ou registro são tratadas de forma não bloqueante.

## 5. Desvios do Technical Plan

- O Database Webhook foi implementado como trigger `pg_net` versionado, usando Vault para o segredo, porque o conector MCP de Firebase não estava disponível nesta sessão.
- O E2E real não foi declarado concluído porque depende de configuração externa e de um dispositivo/navegador controlado.

## 6. Testes Automatizados Adicionados

- Configuração incompleta mantém o FCM desativado.
- Payload FCM flat data-only válido é normalizado para o target compartilhado.
- Destino malformado ou incompatível com o contexto é rejeitado.
- Regressão de capability/permissão do registro de push.
- Regressão do worker único e do tratamento seguro de clique em notificações.

## 7. Resultados dos Portões de Qualidade

- **Lint**: `npm run lint` — aprovado, 0 erros.
- **Testes focados**: 3 arquivos / 6 testes — aprovados.
- **Testes completos**: `npm test` — aprovado, 125 arquivos / 836 testes.
- **Build Student**: aprovado.
- **Build Instructor**: aprovado.
- **Build Admin**: aprovado.
- **Build Landing**: aprovado.
- **Diff check**: `git diff --check` — aprovado; somente avisos de normalização LF/CRLF.

## 8. Testes Manuais Realizados

- Firebase CLI autenticada e projeto DEV confirmado como `mazzi-af65c`.
- Web App Firebase ativo confirmado: `Mazzi Web`, App ID registrado no projeto DEV.
- Verificado que existe somente `public/sw.js`; não existe `firebase-messaging-sw.js` concorrente.
- Verificado que o repositório não contém service account, VAPID privada, bearer token ou segredo FCM no cliente.
- Edge Function respondeu `401` ao POST sem o segredo e `405` ao GET, confirmando a barreira de entrada.
- Migration ledger, webhook versionado e secrets DEV foram conferidos remotamente sem expor valores.
- Ainda não foi realizado envio real de push porque a chave VAPID pública não está disponível no Firebase DEV.

## 9. Limitações e Riscos Conhecidos

- O ambiente local não possui `VITE_FIREBASE_*` nem `VITE_FCM_VAPID_KEY` preenchidos; o workflow está preparado para injetá-los somente no build da branch DEV.
- A chave VAPID pública ainda precisa ser confirmada e injetada exclusivamente no ambiente DEV.
- O registro de device e a entrega FCM dependem da chave VAPID pública e do E2E em navegador real.
- O fluxo completo `BOOKING_CONFIRMED`, warm start, cold start, sessão expirada e retomada pós-login ainda depende do backend e de dispositivo controlado.
- A suíte completa exibiu um `DOMException [AbortError]` de teardown do happy-dom, mas terminou com 836 testes aprovados e código de saída de sucesso.
- Os builds mantêm avisos de chunks acima de 500 kB; não houve falha de compilação.

## 10. Handoff para QA

1. Injetar no ambiente DEV os valores públicos do Firebase `mazzi-af65c` e a VAPID pública aprovada.
2. Revisar/aplicar separadamente a infraestrutura server-side DEV e confirmar que nenhum recurso de Production é usado.
3. Validar o CTA em permissão `default`, `granted`, `denied` e navegador sem suporte.
4. Executar o E2E obrigatório `BOOKING_CONFIRMED` no contexto `STUDENT`, incluindo recebimento em foreground/background, cold start com PWA fechado e retomada após login.
5. Validar isolamento entre `STUDENT` e `PRO`, múltiplos dispositivos, rotação/invalidação do token e ausência de duplicidade.

`PRODUCTION_UNTOUCHED`
