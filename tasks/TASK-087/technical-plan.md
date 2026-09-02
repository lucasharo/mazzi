# Technical Plan — TASK-087

TASK: TASK-087  
STATUS: TECH_READY  
OWNER: MAZZI Tech Lead  
LAST_UPDATED: 2026-09-02

## 1. Resumo técnico

Integrar FCM Web Push somente no ambiente DEV, mantendo o Supabase como fonte de verdade. O Firebase será usado apenas para obter/transportar o token e entregar o push; histórico, autorização, deduplicação, contexto (`STUDENT`/`PRO`) e destino continuam no MAZZI/Supabase.

A integração deve usar o `public/sw.js` já existente. O cliente FCM obterá o token usando a mesma `ServiceWorkerRegistration`; o worker normalizará o payload mínimo do FCM para o contrato de navegação já criado. O dispatcher será uma Edge Function server-side acionada por INSERT em `notifications`, com credenciais FCM exclusivamente em secrets do Supabase DEV.

O plano não cria Firebase Auth, Firestore, Firebase Hosting ou Firebase Functions, não cria um segundo Service Worker e não altera Production.

## 2. Auditoria da base existente

- `src/lib/push-device-registry.ts` já trata capacidade/permissão e chama `register_my_push_device`, mas ainda usa configuração genérica e não obtém token FCM.
- `src/registerServiceWorker.ts` registra o worker único, porém não entrega a registration ao cliente FCM.
- `public/sw.js` já possui handlers `push` e `notificationclick`, validação de evento/contexto/destino e cache conservador; precisa aceitar o envelope de dados do FCM sem relaxar a allowlist.
- `src/lib/notification-navigation.ts` é o resolvedor canônico e deve continuar sendo a referência de destino do sino, do push e do pós-login.
- `src/lib/db-service.ts` e `src/lib/database.types.ts` já possuem o contrato inicial do registry.
- `supabase/migrations/20260902040000_task_086_earnings_notifications_push.sql` contém o registry e as RPCs iniciais, mas foi marcado como local-only; TASK-087 deve criar somente a extensão necessária, sem duplicar `user_push_devices`.
- Não existe dispatcher FCM nas `supabase/functions/` e não há configuração Firebase/FCM versionada.
- `.github/workflows/ci.yml` já publica os quatro apps no Cloudflare Pages DEV para `feature/premium-ui-v2`; os novos valores públicos do Firebase deverão ser injetados apenas no ambiente DEV.

## 3. Preflight obrigatório antes de qualquer mutation

Executar e registrar, sem imprimir valores secretos:

1. Branch, `HEAD`, `git status`, arquivos de Service Worker e estado dos testes/builds locais.
2. Firebase CLI com `npx -y firebase-tools@latest --version`, conta autenticada, `firebase use` e `apps:list` para confirmar inequivocamente o projeto DEV. O projeto anteriormente identificado como `mazzi-af65c` deve ser revalidado; o App Web, project number e VAPID público ainda precisam ser confirmados. Não criar outro projeto ou App Web sem aprovação explícita.
3. Supabase CLI/projeto vinculado, migrations aplicadas, Edge Functions existentes e identificação inequívoca do projeto DEV. Não consultar nem alterar Production.
4. Confirmar que não existe `firebase-messaging-sw.js` ou outro worker concorrente. Se existir, a integração deve ser interrompida e consolidada no `public/sw.js` único.
5. Confirmar os nomes finais das variáveis públicas e dos secrets antes de configurar CI/Supabase. Registrar somente nomes, IDs não sensíveis e o estado de presença/ausência.

## 4. Arquivos previstos

### Novos

- `[NEW]` `src/lib/firebase-messaging.ts` — inicialização do Firebase Web SDK, `getToken` com a registration existente, `onMessage` e normalização tipada; falha de configuração não bloqueia o app.
- `[NEW]` `src/components/notifications/PushNotificationOptIn.tsx` — CTA explícito para Aluno/PRO, sem prompt automático na inicialização, estados `LOADING`, `SUCCESS`, `DISABLED`, `UNSUPPORTED` e `ERROR`.
- `[NEW]` `supabase/functions/dispatch-push-notification/index.ts` — webhook autenticado server-to-server, leitura da notificação no Supabase, seleção de devices autorizados e envio FCM HTTP v1.
- `[NEW]` `supabase/functions/_shared/fcm-http-v1.ts` — autenticação server-side e cliente mínimo do FCM HTTP v1, sem dependência no bundle do navegador.
- `[NEW]` `supabase/migrations/<timestamp>_task_087_fcm_dispatch.sql` — tabela de entregas, constraints, RPCs server-only e hardening do registry. O timestamp deve ser gerado pelo CLI de migration, não inventado.
- `[NEW]` `tests/firebase-messaging.test.ts` — configuração, registration, token, permissionamento e falhas não bloqueantes.
- `[NEW]` `tests/fcm-dispatcher.test.ts` — payload, idempotência, retry e classificação de respostas do FCM.

### Modificados

- `[MODIFY]` `package.json` e `package-lock.json` — adicionar versão fixa do pacote `firebase` somente se o SDK modular for adotado.
- `[MODIFY]` `src/registerServiceWorker.ts` — preservar o único registro e expor uma Promise da `ServiceWorkerRegistration` para o cliente FCM.
- `[MODIFY]` `src/lib/push-device-registry.ts` — obter token FCM, registrar o token como endpoint privado do device, tratar rotação e desativação; remover `any` novo e não registrar token em logs.
- `[MODIFY]` `src/lib/db-service.ts` e `src/lib/database.types.ts` — manter RPCs tipadas e adaptar o endpoint FCM sem permitir SELECT direto no registry.
- `[MODIFY]` `src/components/notifications/NotificationsPanel.tsx` — montar o CTA somente para `STUDENT`/`PRO` e reutilizar a mesma atualização do histórico; não enviar o corpo privado ao FCM.
- `[MODIFY]` `src/apps/student/StudentApp.tsx`, `src/apps/provider/ProviderApp.tsx` e respectivos entrypoints — inicializar o push somente depois da sessão/contexto estarem hidratados e desativar o device no logout de forma best-effort.
- `[MODIFY]` `public/sw.js` — aceitar somente payload FCM data-only normalizado, preservar a validação atual, exibir tag idempotente por `notificationId` e manter o click no resolvedor/hash allowlisted.
- `[MODIFY]` `.env.example` — documentar apenas variáveis públicas sem valores reais.
- `[MODIFY]` `.github/workflows/ci.yml` — passar configuração pública FCM somente ao build DEV; nunca injetar service account, VAPID privado ou service role no bundle.
- `[MODIFY]` `tests/push-device-registry.test.ts`, `tests/service-worker-notifications.test.ts`, `tests/notification-navigation.test.ts` e `tests/database-schema.test.ts` — regressões do contrato TASK-086 e da segurança.
- `[MODIFY]` `docs/26-pro-earnings-notification-navigation.md` e `docs/CURRENT_IMPLEMENTATION_STATUS.md` — atualizar somente com o que estiver realmente implementado e homologado.

## 5. Contrato FCM Web

1. Criar/usar um único App Web no projeto Firebase DEV confirmado e obter a configuração pública por CLI. API key, project ID, sender ID, app ID e VAPID público são configuração de cliente, mas devem ter restrição de domínio no Firebase e não podem ser confundidos com secrets.
2. Recomenda-se manter `VITE_PUSH_PROVIDER=FCM` e adotar nomes explícitos para a configuração pública: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` e `VITE_FCM_VAPID_KEY`. A nomenclatura final deve ser confirmada no preflight; não manter dois contratos concorrentes.
3. `getToken` deve receber `serviceWorkerRegistration` do worker único e `vapidKey` público. A solicitação de permissão só ocorre após ação explícita do usuário.
4. O registro enviado ao Supabase deve conter `provider=FCM`, contexto explícito e fingerprint local não identificável. O token FCM fica somente no campo privado do registry e no lado server-side; nunca retorna em listagens, logs, URLs ou payload de navegação.
5. A mensagem FCM deve ser data-only e mínima: `notificationId`, `eventType`, `appContext`, `version`, `entityType`, `entityId` e `action`. O worker deve converter campos string para o target tipado, rejeitar payload malformado e não aceitar `data.url`, texto livre ou origem externa.
6. Em primeiro plano, `onMessage` atualiza o histórico/indicador e pode exibir feedback mínimo com a mesma `notificationId`; em background/cold start, `public/sw.js` exibe a notificação e o `notificationclick` reutiliza/foca a janela existente ou abre apenas o entrypoint allowlisted.

## 6. Banco, RLS e RBAC

### 6.1 Migration DEV

Criar a migration TASK-087 após a migration TASK-086 estar revisada. Se TASK-086 ainda não estiver no DEV, aplicar ambas em ordem, primeiro localmente e depois no Supabase DEV autorizado; nunca editar migration histórica.

- Criar `public.push_deliveries` com `notification_id`, `device_id`, provider, status (`PENDING`, `PROCESSING`, `SENT`, `RETRY`, `FAILED`), tentativa, timestamps, identificador externo opcional e erro sanitizado.
- Criar `UNIQUE(notification_id, device_id)` e índices para retry/status. Uma nova tentativa nunca cria uma segunda entrega lógica.
- Habilitar RLS e revogar acesso direto de `PUBLIC`, `anon` e `authenticated` a `user_push_devices` e `push_deliveries`.
- Adicionar RPCs server-only para claim/finalização da entrega e invalidação de token. O claim deve ser atômico, limitar tentativas e impedir concorrência duplicada.
- Fortalecer `register_my_push_device`: derivar `auth.uid()`, aceitar nesta tarefa somente `STUDENT` e `PRO`, validar que o contexto corresponde ao papel/permissão real e nunca confiar em `app_context` enviado pelo cliente para autorização. `ADMIN` não recebe push nesta entrega.
- Manter a atualização/disable do próprio device como best-effort no logout e permitir invalidação server-side quando o FCM responder `UNREGISTERED`/token inválido.
- Preservar `notifications` como histórico canônico, suas policies por `user_id`, o `navigation_action` imutável para o cliente e a deduplicação dos eventos de negócio.

### 6.2 Dispatcher server-side

- Configurar no Supabase DEV um Database Webhook para INSERT em `public.notifications`, apontando para `dispatch-push-notification`.
- Como o webhook não possui a sessão do usuário, usar autenticação própria de servidor com secret armazenado no Supabase e comparação constante; a Edge Function não deve ficar publicamente invocável. `verify_jwt=false` só é aceitável com essa autenticação customizada documentada.
- A função deve buscar a row canônica pelo `notification_id` e não confiar no corpo do webhook para usuário, contexto, entidade, ação ou texto.
- Selecionar apenas devices ativos do mesmo `user_id` e `app_context`, com `provider=FCM`, e nunca enviar para outro contexto/tenant.
- Criar/claimar uma entrega por device, enviar pelo FCM HTTP v1 usando service account exclusivamente em secret server-side e finalizar o status com erro sanitizado.
- Repetir somente falhas transitórias (`429`, indisponibilidade e `5xx`) com limite e backoff; token inválido/expirado desativa o device e não entra em retry infinito.
- Em qualquer falha, preservar a row original de `notifications` e o histórico in-app. O dispatcher não confirma reserva, não altera pagamentos e não calcula autorização no frontend.

Secrets DEV previstos, somente por nome: credencial/service account FCM, segredo do webhook e flags/identificadores server-side necessários. Nenhum desses valores pode aparecer em `src`, `public`, GitHub Pages, `.env.example`, documentação ou logs.

## 7. Ordem segura de implementação e publicação

1. Executar o preflight somente leitura e bloquear a execução se Firebase/Supabase não forem inequivocamente DEV (`PRODUCTION_UNTOUCHED`).
2. Confirmar o App Web/VAPID do projeto Firebase DEV; não criar projeto duplicado.
3. Revisar e validar localmente a migration TASK-086; aplicar no DEV somente se autorizada e ausente, antes da migration TASK-087.
4. Implementar contrato FCM/client, CTA explícito, registro/rotação e integração com a registration existente; manter o push desabilitado quando a configuração estiver ausente.
5. Implementar migration TASK-087 e dispatcher com claim idempotente; testar localmente sem secrets reais e com respostas FCM simuladas apenas nos testes unitários, nunca como E2E.
6. Rodar os gates locais: `npm run lint`, `npm test`, `npm run build:all` e `git diff --check`. Corrigir qualquer falha antes de tocar no DEV.
7. Configurar os secrets no projeto Supabase DEV, aplicar migrations DEV em ordem, publicar somente a Edge Function DEV e configurar o Database Webhook DEV. Registrar nomes/versões, nunca valores.
8. Injetar somente a configuração pública Firebase DEV no ambiente `development` do GitHub Actions e publicar os quatro apps pelo fluxo já existente da branch `feature/premium-ui-v2`. Não executar o fluxo de `main`.
9. Executar o E2E manual com conta/dispositivo controlados e registrar evidências. Só então enviar para QA; conexão Firebase, token criado, webhook recebido ou HTTP 200 isolado não encerram a TASK.

## 8. Testes obrigatórios

- Permissão `default`, `granted`, `denied`, navegador sem suporte e configuração ausente sem bloquear o uso do MAZZI nem abrir prompt automático.
- Reuso do único Service Worker, obtenção de token com a registration correta, rotação, fingerprint, logout/desativação e dois devices do mesmo usuário.
- Payload FCM data-only válido, envelope malformado, evento/contexto/ação incompatíveis, UUID inválido, URL arbitrária, PII e corpo privado rejeitados.
- `push`/`notificationclick` em worker: notificação única por `notificationId`, foco/reuso de janela, cold start e fallback seguro para `Aulas`/`Ganhos`/`Gestão`.
- Dispatcher: usuário/contexto correto, múltiplos devices, `UNIQUE(notification_id, device_id)`, concorrência de claim, retry limitado, `UNREGISTERED`, resposta 5xx/429, erro sanitizado e histórico preservado.
- RLS/RBAC: Aluno A não lê device/entrega do Aluno B; contexto `PRO` não alcança Student; `ADMIN` não registra device; nenhum cliente acessa token ou tabela privada; dispatcher é a única via de envio.
- Regressões da navegação compartilhada: sino e push usam o mesmo target, entidade inacessível cai no fallback, sessão expirada preserva o destino após login e não abre janela duplicada.
- Gates finais reais: `npm run lint`, `npm test`, `npm run build:all` e `git diff --check`. Registrar contagens e resultado no relatório da TASK.

## 9. Limitações da validação E2E manual

- O cold start com PWA fechado, a permissão do navegador, a entrega em background e a exibição na tela bloqueada dependem de navegador/OS/dispositivo controlado e não são comprovados integralmente por Vitest.
- O tunnel precisa fornecer HTTPS e origem estável; mudança de origem pode gerar novo token e invalidar a evidência anterior.
- A entrega FCM não é uma confirmação de leitura nem garante latência fixa. Registrar horário do evento, `notification_id`, contexto, resposta sanitizada do dispatcher e a navegação observada.
- O primeiro E2E obrigatório é `BOOKING_CONFIRMED` para `STUDENT`. `PAYOUT_PAID`, multi-role e `NEW_MESSAGE` só devem ser testados se houver fixtures DEV seguras; caso contrário, documentar a limitação sem criar dados financeiros ou mensagens artificiais.
- Não usar dispositivos reais de terceiros, dados de produção, payload com conteúdo privado ou evidência de token completo.

## 10. O que não alterar

- Não criar `firebase-messaging-sw.js`, segundo worker, Firebase Auth, Firestore, Firebase Hosting ou Firebase Functions.
- Não alterar Stripe, checkout, confirmação server-side, payouts, split, regras de negócio, RLS de outros domínios ou o resolvedor de navegação para contornar autorização.
- Não liberar SELECT direto em `user_push_devices`, `push_deliveries`, `payouts` ou qualquer Storage privado.
- Não usar `service_role`, service account, VAPID privado ou bearer token no frontend, bundle, CI público, logs ou documentação.
- Não enviar CPF, endereço, documento, evidência, texto integral de chat ou detalhe financeiro sensível no push.
- Não aplicar migration, cadastrar secrets, configurar webhook ou fazer deploy remoto durante a etapa de elaboração deste plano; essas ações pertencem à ordem segura acima e exigem identificação DEV comprovada.

## 11. Evidências para o relatório final

O `implementation-report.md`/relatório de QA deverá registrar: project ID e Supabase ref DEV, App ID Web e presença do VAPID sem valores secretos, migration IDs e versão da Edge Function, branch/commit, quality gates, ausência de infraestrutura concorrente, matriz de E2E, limitações reais e a declaração literal `PRODUCTION_UNTOUCHED`.
